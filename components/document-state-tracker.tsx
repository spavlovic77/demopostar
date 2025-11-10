"use client"

import { CheckCircle, Clock, Send, AlertTriangle, XCircle, Loader2, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

export type DocumentState = "QUEUED" | "SENDING" | "SENT" | "DEFERRED" | "ERROR"

interface DocumentStateTrackerProps {
  currentState: DocumentState
  fundReserved?: boolean
  fundsProcessed?: boolean
  progressivePolling?: boolean
  className?: string
}

const getStepStatus = (
  currentState: DocumentState,
  fundReserved: boolean,
  fundsProcessed: boolean,
  progressivePolling: boolean,
) => {
  return [
    {
      key: "initiated",
      label: "Sending Initiated",
      icon: Send,
      completed: currentState !== "QUEUED" || fundReserved,
      active: true,
    },
    {
      key: "queued",
      label: "Document Queued",
      icon: Clock,
      completed: currentState !== "QUEUED",
      active:
        currentState === "QUEUED" ||
        currentState === "SENDING" ||
        currentState === "SENT" ||
        currentState === "ERROR" ||
        currentState === "DEFERRED",
    },
    {
      key: "reserved",
      label: "Funds Reserved",
      icon: Shield,
      completed: fundReserved,
      active: fundReserved,
    },
    {
      key: "status",
      label:
        currentState === "SENT"
          ? "Document Sent"
          : currentState === "ERROR"
            ? "Document Error"
            : currentState === "DEFERRED"
              ? "Document Deferred"
              : "Processing",
      icon:
        currentState === "SENT"
          ? CheckCircle
          : currentState === "ERROR"
            ? XCircle
            : currentState === "DEFERRED"
              ? AlertTriangle
              : Loader2,
      completed: currentState === "SENT" || currentState === "ERROR",
      active:
        currentState === "SENDING" ||
        currentState === "SENT" ||
        currentState === "ERROR" ||
        currentState === "DEFERRED",
    },
    {
      key: "funds",
      label: fundsProcessed ? (currentState === "ERROR" ? "Funds Refunded" : "Funds Deducted") : "Processing Funds",
      icon: fundsProcessed ? CheckCircle : Loader2,
      completed: fundsProcessed,
      active: (currentState === "SENT" || currentState === "ERROR") && !progressivePolling,
    },
    {
      key: "polling",
      label: "Progressive Polling Started",
      icon: progressivePolling ? CheckCircle : Clock,
      completed: progressivePolling,
      active: currentState === "DEFERRED",
    },
  ]
}

export function DocumentStateTracker({
  currentState,
  fundReserved = false,
  fundsProcessed = false,
  progressivePolling = false,
  className,
}: DocumentStateTrackerProps) {
  const steps = getStepStatus(currentState, fundReserved, fundsProcessed, progressivePolling)
  const activeSteps = steps.filter((step) => step.active)

  return (
    <div className={cn("w-full space-y-3", className)}>
      {activeSteps.map((step, index) => {
        const Icon = step.icon
        const isSpinning =
          !step.completed &&
          step.active &&
          ((step.key === "status" && currentState === "SENDING") || (step.key === "funds" && !fundsProcessed))

        return (
          <div
            key={step.key}
            className={cn(
              "flex items-center p-3 rounded-lg border transition-all duration-300",
              step.completed
                ? "bg-primary/10 border-primary/20 text-primary"
                : step.active
                  ? "bg-accent/50 border-accent text-accent-foreground"
                  : "bg-muted border-border text-muted-foreground",
            )}
          >
            <div
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full mr-3",
                step.completed ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {isSpinning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
            </div>
            <span className="font-medium">{step.label}</span>
          </div>
        )
      })}
    </div>
  )
}
