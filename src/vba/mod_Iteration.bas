Attribute VB_Name = "mod_Iteration"
Option Explicit

' =============================================================================
' mod_Iteration.bas
' Iteration helpers for the Bridge Loss Calculator
'
' Provides convergence detection, bisection midpoint, secant update, and
' iteration logging utilities consumed by Energy, Momentum, and WSPRO solvers.
'
' VBA lacks first-class function callbacks, so each method module implements
' its own loop and calls these helpers directly.
' =============================================================================

' -----------------------------------------------------------------------------
' IterationResult
'
' Returned by solver loops to report final convergence status and statistics.
' -----------------------------------------------------------------------------
Public Type IterationResult
    converged   As Boolean
    finalValue  As Double
    iterations  As Long
    finalError  As Double
End Type

' -----------------------------------------------------------------------------
' IterationLog
'
' Fixed-capacity (100 entries) log of per-iteration trial WSEL, computed WSEL,
' and the absolute error between them.  Populated via LogIteration.
' -----------------------------------------------------------------------------
Public Type IterationLog
    trialWSEL(1 To 100)    As Double
    computedWSEL(1 To 100) As Double
    errorVal(1 To 100)     As Double
    nEntries               As Long
End Type

' -----------------------------------------------------------------------------
' BisectMidpoint
'
' Returns the midpoint of the interval [lower, upper].
' Used as the default bracket-halving step in bisection and as a fallback
' when the secant denominator is near zero.
' -----------------------------------------------------------------------------
Public Function BisectMidpoint(ByVal lower As Double, ByVal upper As Double) As Double
    BisectMidpoint = (lower + upper) / 2#
End Function

' -----------------------------------------------------------------------------
' IsConverged
'
' Returns True when the absolute difference between the trial and computed
' water surface elevations is within the specified tolerance.
' -----------------------------------------------------------------------------
Public Function IsConverged(ByVal trial As Double, ByVal computed As Double, _
                            ByVal tolerance As Double) As Boolean
    IsConverged = (Abs(trial - computed) <= tolerance)
End Function

' -----------------------------------------------------------------------------
' SecantUpdate
'
' Computes the next iterate using the secant method:
'   x_new = x2 - f2 * (x2 - x1) / (f2 - f1)
'
' where f(x) = computed_WSEL(x) - x  (i.e. the residual of the fixed-point
' equation).  If the denominator |f2 - f1| is near zero (< 1e-12) the method
' falls back to the bisection midpoint of x1 and x2 to avoid division issues.
'
' Parameters:
'   x1, x2  — two most-recent trial WSEL values
'   f1, f2  — residuals (computed - trial) at x1 and x2 respectively
' -----------------------------------------------------------------------------
Public Function SecantUpdate(ByVal x1 As Double, ByVal f1 As Double, _
                             ByVal x2 As Double, ByVal f2 As Double) As Double
    Dim denom As Double
    denom = f2 - f1

    If Abs(denom) < 1E-12 Then
        ' Denominator too small — fall back to bisection midpoint
        SecantUpdate = BisectMidpoint(x1, x2)
    Else
        SecantUpdate = x2 - f2 * (x2 - x1) / denom
    End If
End Function

' -----------------------------------------------------------------------------
' LogIteration
'
' Appends one entry to the IterationLog.  Silently does nothing when the log
' is already full (nEntries = 100) to avoid array overruns.
'
' Parameters:
'   log      — ByRef IterationLog being accumulated
'   trial    — trial WSEL for this iteration
'   computed — computed WSEL resulting from that trial
'   errVal   — absolute error |computed - trial|
' -----------------------------------------------------------------------------
Public Sub LogIteration(ByRef log As IterationLog, _
                        ByVal trial As Double, _
                        ByVal computed As Double, _
                        ByVal errVal As Double)
    If log.nEntries >= 100 Then Exit Sub

    log.nEntries = log.nEntries + 1
    log.trialWSEL(log.nEntries)    = trial
    log.computedWSEL(log.nEntries) = computed
    log.errorVal(log.nEntries)     = errVal
End Sub

' -----------------------------------------------------------------------------
' WriteIterationLog
'
' Writes the contents of an IterationLog to a worksheet beginning at
' (startRow, startCol).
'
' Column layout:
'   +0  "Iteration #"
'   +1  "Trial WSEL (ft)"
'   +2  "Computed WSEL (ft)"
'   +3  "Error (ft)"
'   +4  "Status"
'
' The Status column is populated only for the last entry:
'   "CONVERGED"     if the final error is <= 0.01 ft
'   "NOT CONVERGED" otherwise
' All other rows in the Status column are left blank.
'
' Parameters:
'   ws        — target Worksheet object (late-bound As Object for portability)
'   startRow  — 1-based row for the header row
'   startCol  — 1-based column for the first column
'   log       — ByRef IterationLog to write out
' -----------------------------------------------------------------------------
Public Sub WriteIterationLog(ByVal ws As Object, _
                             ByVal startRow As Long, _
                             ByVal startCol As Long, _
                             ByRef log As IterationLog)

    ' --- Write column headers ---
    ws.Cells(startRow, startCol).Value     = "Iteration #"
    ws.Cells(startRow, startCol + 1).Value = "Trial WSEL (ft)"
    ws.Cells(startRow, startCol + 2).Value = "Computed WSEL (ft)"
    ws.Cells(startRow, startCol + 3).Value = "Error (ft)"
    ws.Cells(startRow, startCol + 4).Value = "Status"

    ' --- Write data rows ---
    Dim i As Long
    For i = 1 To log.nEntries
        Dim dataRow As Long
        dataRow = startRow + i  ' header is at startRow, data starts one below

        ws.Cells(dataRow, startCol).Value     = i
        ws.Cells(dataRow, startCol + 1).Value = log.trialWSEL(i)
        ws.Cells(dataRow, startCol + 2).Value = log.computedWSEL(i)
        ws.Cells(dataRow, startCol + 3).Value = log.errorVal(i)

        ' Status: populate only the last entry
        If i = log.nEntries Then
            If log.errorVal(i) <= 0.01 Then
                ws.Cells(dataRow, startCol + 4).Value = "CONVERGED"
            Else
                ws.Cells(dataRow, startCol + 4).Value = "NOT CONVERGED"
            End If
        Else
            ws.Cells(dataRow, startCol + 4).Value = ""
        End If
    Next i
End Sub
