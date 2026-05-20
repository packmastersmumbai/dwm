---
name: Industrial Quality Framework
description: A high-density, status-driven design system optimized for industrial QMS applications and factory floor mobile devices.

colors:
  primary: "#1E3A8A" # Deep Navy - Trust and Authority
  on-primary: "#FFFFFF"
  primary-container: "#DBEAFE"
  on-primary-container: "#1E3A8A"
  
  secondary: "#475569" # Slate - Functional and Neutral
  on-secondary: "#FFFFFF"
  secondary-container: "#F1F5F9"
  on-secondary-container: "#1E293B"

  surface: "#FAF8FF" # Clean Cool Gray
  on-surface: "#1A1C1E"
  surface-variant: "#E1E2E9"
  on-surface-variant: "#44474E"
  outline: "#74777F"
  outline-variant: "#C4C7CF"

  # Status Colors (Critical for Industrial Feedback)
  error: "#BA1A1A" # Red - Critical Failure / NCR
  on-error: "#FFFFFF"
  warning: "#D97706" # Amber - Pending / Under Target
  on-warning: "#FFFFFF"
  success: "#15803D" # Green - Passed / Running
  on-success: "#FFFFFF"

typography:
  font-family: "Inter, sans-serif"
  scales:
    display-lg: { size: "32px", weight: "700", leading: "40px" }
    headline-md: { size: "24px", weight: "600", leading: "32px" }
    headline-sm: { size: "20px", weight: "600", leading: "28px" }
    title-md: { size: "16px", weight: "600", leading: "24px" }
    body-md: { size: "14px", weight: "400", leading: "20px" }
    label-md: { size: "12px", weight: "500", leading: "16px" }
    label-sm: { size: "11px", weight: "500", leading: "14px" }

spacing:
  base: "8px"
  container-margin: "16px"
  gutter: "12px"
  density: "compact" # Minimal whitespace for maximum data visibility

components:
  cards:
    shape: "rounded-lg"
    border: "1px solid outline-variant"
    elevation: "none"
  buttons:
    shape: "rounded-md"
    padding: "10px 16px"
    weight: "600"
  inputs:
    shape: "rounded-md"
    background: "surface"
    border: "1px solid outline"

principles:
  1. Information Density: Prioritize data over decoration. Use compact spacing and small font scales to minimize scrolling on small devices.
  2. Status Visibility: Use primary status colors (Green, Amber, Red) for immediate operational feedback.
  3. Scannability: Use bold headers and clear labels to guide the eye through technical data sets.
  4. Accessibility: Ensure high contrast for all critical status indicators and touch targets suitable for factory floor environments.
---