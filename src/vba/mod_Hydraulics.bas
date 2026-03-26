Attribute VB_Name = "mod_Hydraulics"
Option Explicit

' =============================================================================
' mod_Hydraulics.bas
' Hydraulic utility functions for Bridge Loss Calculator
'
' Provides core hydraulic calculations used by all four bridge loss methods:
'   - Velocity and velocity head
'   - Froude number
'   - Friction slope and friction loss
'   - Flow regime detection
'   - TUFLOW form loss coefficient back-calculation
'   - Pressure flow and weir flow
' =============================================================================

Private Const GRAVITY As Double = 32.2

' -----------------------------------------------------------------------------
' CalcVelocity
'
' Computes average velocity (ft/s) from discharge and flow area.
'   V = Q / A
'
' Returns 0 if area is zero or negative (zero-guard).
' -----------------------------------------------------------------------------
Public Function CalcVelocity(Q As Double, area As Double) As Double
    If area <= 0# Then
        CalcVelocity = 0#
    Else
        CalcVelocity = Q / area
    End If
End Function

' -----------------------------------------------------------------------------
' CalcVelocityHead
'
' Computes the velocity head (ft) with an energy correction factor alpha.
'   hv = alpha * V^2 / (2 * g)
'
' alpha = 1.0 for uniform flow; values > 1.0 correct for non-uniform profiles.
' g = 32.2 ft/s^2
' -----------------------------------------------------------------------------
Public Function CalcVelocityHead(velocity As Double, alpha As Double) As Double
    CalcVelocityHead = alpha * (velocity ^ 2#) / (2# * GRAVITY)
End Function

' -----------------------------------------------------------------------------
' CalcFroude
'
' Computes the Froude number for a cross-section.
'   Fr = V / sqrt(g * D)
'
' where D = hydraulic depth = A / T  (flow area / top width).
' Returns 0 if topWidth is zero or negative (prevents division by zero).
' Returns 0 if the hydraulic depth is zero or negative.
' -----------------------------------------------------------------------------
Public Function CalcFroude(velocity As Double, area As Double, topWidth As Double) As Double
    If topWidth <= 0# Then
        CalcFroude = 0#
        Exit Function
    End If

    Dim D As Double
    D = area / topWidth

    If D <= 0# Then
        CalcFroude = 0#
        Exit Function
    End If

    CalcFroude = velocity / Sqr(GRAVITY * D)
End Function

' -----------------------------------------------------------------------------
' CalcFrictionSlope
'
' Computes the friction slope Sf at a cross-section using conveyance.
'   Sf = (Q / K)^2
'
' Returns 0 if conveyance is zero or negative (zero-guard).
' -----------------------------------------------------------------------------
Public Function CalcFrictionSlope(Q As Double, conveyance As Double) As Double
    If conveyance <= 0# Then
        CalcFrictionSlope = 0#
    Else
        CalcFrictionSlope = (Q / conveyance) ^ 2#
    End If
End Function

' -----------------------------------------------------------------------------
' CalcAvgFrictionSlope
'
' Computes the average friction slope between two cross-sections using the
' arithmetic mean (standard average conveyance method).
'   Sf_avg = (Sf1 + Sf2) / 2
' -----------------------------------------------------------------------------
Public Function CalcAvgFrictionSlope(sf1 As Double, sf2 As Double) As Double
    CalcAvgFrictionSlope = (sf1 + sf2) / 2#
End Function

' -----------------------------------------------------------------------------
' CalcFrictionLoss
'
' Computes the friction head loss over a reach.
'   hf = Sf_avg * L
'
' Parameters:
'   avgSf       - average friction slope (ft/ft)
'   reachLength - distance between cross-sections (ft)
' -----------------------------------------------------------------------------
Public Function CalcFrictionLoss(avgSf As Double, reachLength As Double) As Double
    CalcFrictionLoss = avgSf * reachLength
End Function

' -----------------------------------------------------------------------------
' DetectFlowRegime
'
' Classifies the bridge flow regime based on water surface elevation (wsel)
' relative to the low chord and high chord of the bridge opening.
'
' Returns:
'   "F" (Free surface)  — wsel <= lowChord  (open channel flow)
'   "P" (Pressure)      — lowChord < wsel <= highChord  (submerged soffit)
'   "O" (Overtopping)   — wsel > highChord  (flow over the bridge deck)
' -----------------------------------------------------------------------------
Public Function DetectFlowRegime(wsel As Double, lowChord As Double, highChord As Double) As String
    If wsel <= lowChord Then
        DetectFlowRegime = "F"
    ElseIf wsel <= highChord Then
        DetectFlowRegime = "P"
    Else
        DetectFlowRegime = "O"
    End If
End Function

' -----------------------------------------------------------------------------
' CalcTuflowFLC
'
' Back-calculates a TUFLOW Form Loss Coefficient (FLC) from a known head loss
' and approach velocity.
'   FLC = h_loss / (V^2 / (2 * g))
'
' The FLC represents the number of approach velocity heads lost at the structure,
' used as input to TUFLOW bridge/culvert loss parameters.
'
' Returns 0 if the velocity head is zero (zero-guard).
' -----------------------------------------------------------------------------
Public Function CalcTuflowFLC(headLoss As Double, approachVelocity As Double) As Double
    Dim velHead As Double
    velHead = CalcVelocityHead(approachVelocity, 1#)

    If velHead <= 0# Then
        CalcTuflowFLC = 0#
    Else
        CalcTuflowFLC = headLoss / velHead
    End If
End Function

' -----------------------------------------------------------------------------
' CalcTuflowPierFLC
'
' Back-calculates the TUFLOW pier Form Loss Coefficient from pier-induced head
' loss and approach velocity. Wrapper around CalcTuflowFLC.
'   FLC_pier = pierHeadLoss / (V^2 / (2 * g))
' -----------------------------------------------------------------------------
Public Function CalcTuflowPierFLC(pierHeadLoss As Double, approachVelocity As Double) As Double
    CalcTuflowPierFLC = CalcTuflowFLC(pierHeadLoss, approachVelocity)
End Function

' -----------------------------------------------------------------------------
' CalcTuflowSuperFLC
'
' Back-calculates the TUFLOW superstructure Form Loss Coefficient from
' superstructure-induced head loss and approach velocity. Wrapper around
' CalcTuflowFLC.
'   FLC_super = superHeadLoss / (V^2 / (2 * g))
' -----------------------------------------------------------------------------
Public Function CalcTuflowSuperFLC(superHeadLoss As Double, approachVelocity As Double) As Double
    CalcTuflowSuperFLC = CalcTuflowFLC(superHeadLoss, approachVelocity)
End Function

' -----------------------------------------------------------------------------
' CalcPressureFlowLoss
'
' Computes the head loss through a bridge opening under pressure (orifice) flow.
' Uses the orifice equation solved for head loss:
'   V_orifice = Q / (Cd * A)
'   h = V_orifice^2 / (2 * g)
'
' Parameters:
'   Cd          - discharge coefficient (dimensionless)
'   bridgeArea  - net flow area of the bridge opening (sq ft)
'   Q           - discharge (cfs)
'   lowChord    - low chord elevation (ft) [unused directly; reserved for callers]
'   wsel        - water surface elevation (ft) [unused directly; reserved for callers]
'
' Note: lowChord and wsel are accepted as parameters to match the expected
' interface and allow future refinement (e.g., submerged-outlet corrections)
' without changing the call signature.
' -----------------------------------------------------------------------------
Public Function CalcPressureFlowLoss(Cd As Double, bridgeArea As Double, Q As Double, _
                                     lowChord As Double, wsel As Double) As Double
    If Cd <= 0# Or bridgeArea <= 0# Then
        CalcPressureFlowLoss = 0#
        Exit Function
    End If

    Dim vOrifice As Double
    vOrifice = Q / (Cd * bridgeArea)

    CalcPressureFlowLoss = (vOrifice ^ 2#) / (2# * GRAVITY)
End Function

' -----------------------------------------------------------------------------
' CalcWeirFlow
'
' Computes the overtopping weir discharge using the broad-crested weir equation.
'   Q_weir = Cw * L * H^(3/2)
'
' where H = wsel - highChord  (head above the bridge deck / weir crest).
'
' Returns 0 if wsel <= highChord (no overtopping) or if inputs are invalid.
'
' Parameters:
'   Cw          - weir coefficient (typically 2.6 – 3.1 for broad-crested weirs)
'   weirLength  - effective weir length (ft)
'   wsel        - upstream water surface elevation (ft)
'   highChord   - high chord / deck elevation acting as weir crest (ft)
' -----------------------------------------------------------------------------
Public Function CalcWeirFlow(Cw As Double, weirLength As Double, _
                              wsel As Double, highChord As Double) As Double
    Dim H As Double
    H = wsel - highChord

    If H <= 0# Or Cw <= 0# Or weirLength <= 0# Then
        CalcWeirFlow = 0#
    Else
        CalcWeirFlow = Cw * weirLength * (H ^ 1.5)
    End If
End Function
