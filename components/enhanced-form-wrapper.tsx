"use client"

import type React from "react"

import { type ReactNode, useState } from "react"
import { toast } from "@/components/ui/use-toast"
import { FormSubmissionLimiter } from "@/lib/validation-utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, Loader2 } from "lucide-react"

interface EnhancedFormWrapperProps {
  children: ReactNode
  formId: string
  onSubmit: (e: React.FormEvent) => Promise<void> | void
  maxSubmissions?: number
  rateLimitWindowMs?: number
  className?: string
}

export function EnhancedFormWrapper({
  children,
  formId,
  onSubmit,
  maxSubmissions = 5,
  rateLimitWindowMs = 60000,
  className = "",
}: EnhancedFormWrapperProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [rateLimited, setRateLimited] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmitting) return

    // Check rate limiting
    if (!FormSubmissionLimiter.canSubmit(formId, maxSubmissions, rateLimitWindowMs)) {
      const remainingTime = FormSubmissionLimiter.getRemainingTime(formId, rateLimitWindowMs)
      const remainingMinutes = Math.ceil(remainingTime / 60000)

      setRateLimited(true)
      toast({
        title: "Too many attempts",
        description: `Please wait ${remainingMinutes} minute(s) before trying again.`,
        variant: "destructive",
      })

      setTimeout(() => setRateLimited(false), remainingTime)
      return
    }

    setIsSubmitting(true)

    try {
      await onSubmit(e)
    } catch (error) {
      console.error("Form submission error:", error)
      toast({
        title: "Submission failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      {rateLimited && (
        <Alert className="mb-4 border-destructive/50 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Too many submission attempts. Please wait before trying again.</AlertDescription>
        </Alert>
      )}

      {isSubmitting && (
        <Alert className="mb-4 border-blue-500/50 text-blue-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>Processing your request...</AlertDescription>
        </Alert>
      )}

      <fieldset disabled={isSubmitting || rateLimited}>{children}</fieldset>
    </form>
  )
}
