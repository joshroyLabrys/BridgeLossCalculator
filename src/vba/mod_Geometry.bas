Attribute VB_Name = "mod_Geometry"
Option Explicit

' =============================================================================
' mod_Geometry.bas
' Cross-section hydraulic geometry calculations for Bridge Loss Calculator
'
' All cross-sections are defined by paired station/elevation arrays.
' Water surface elevation (wsel) clips the ground profile to the wetted area.
' =============================================================================

' -----------------------------------------------------------------------------
' ClipSegmentToWSEL
'
' Given a ground segment from (x1, z1) to (x2, z2), clips it to the portion
' that lies at or below the water surface elevation (wsel).
'
' Returns True if any wetted portion exists; sets ByRef output coordinates.
' The clipped segment runs from (cx1, cz1) to (cx2, cz2).
' -----------------------------------------------------------------------------
Public Function ClipSegmentToWSEL( _
    ByVal x1 As Double, ByVal z1 As Double, _
    ByVal x2 As Double, ByVal z2 As Double, _
    ByVal wsel As Double, _
    ByRef cx1 As Double, ByRef cz1 As Double, _
    ByRef cx2 As Double, ByRef cz2 As Double) As Boolean

    ' Both points above WSEL — no wetted portion
    If z1 >= wsel And z2 >= wsel Then
        ClipSegmentToWSEL = False
        Exit Function
    End If

    ' Both points at or below WSEL — entire segment is wetted
    If z1 <= wsel And z2 <= wsel Then
        cx1 = x1 : cz1 = z1
        cx2 = x2 : cz2 = z2
        ClipSegmentToWSEL = True
        Exit Function
    End If

    ' Partial submersion — find intersection point
    ' Linear interpolation: t = (wsel - z1) / (z2 - z1)
    Dim t As Double
    t = (wsel - z1) / (z2 - z1)
    Dim xIntersect As Double
    xIntersect = x1 + t * (x2 - x1)

    If z1 <= wsel Then
        ' Left point is wet, right is above — clip right end to intersection
        cx1 = x1 : cz1 = z1
        cx2 = xIntersect : cz2 = wsel
    Else
        ' Left point is above, right is wet — clip left end to intersection
        cx1 = xIntersect : cz1 = wsel
        cx2 = x2 : cz2 = z2
    End If

    ClipSegmentToWSEL = True
End Function

' -----------------------------------------------------------------------------
' CalcFlowArea
'
' Computes the cross-sectional flow area (sq ft) below the water surface using
' trapezoidal integration of depth over the clipped ground profile.
'
' For each ground segment, the contribution is the trapezoid formed by
' (depth at left clipped point + depth at right clipped point) / 2 * segment width.
' Depth = wsel - ground elevation (clamped to 0 at WSEL crossings).
' -----------------------------------------------------------------------------
Public Function CalcFlowArea( _
    stations() As Double, _
    elevations() As Double, _
    nPts As Long, _
    wsel As Double) As Double

    Dim area As Double
    area = 0#

    Dim i As Long
    Dim cx1 As Double, cz1 As Double, cx2 As Double, cz2 As Double

    For i = 0 To nPts - 2
        If ClipSegmentToWSEL(stations(i), elevations(i), stations(i + 1), elevations(i + 1), _
                             wsel, cx1, cz1, cx2, cz2) Then
            ' Depth below WSEL at each clipped endpoint
            Dim d1 As Double, d2 As Double
            d1 = wsel - cz1
            d2 = wsel - cz2
            ' Ensure non-negative (clipped endpoints are at WSEL so depth=0 there)
            If d1 < 0# Then d1 = 0#
            If d2 < 0# Then d2 = 0#
            Dim segWidth As Double
            segWidth = cx2 - cx1
            area = area + (d1 + d2) / 2# * segWidth
        End If
    Next i

    CalcFlowArea = area
End Function

' -----------------------------------------------------------------------------
' CalcWettedPerimeter
'
' Computes the wetted perimeter (ft) — the sum of ground segment lengths
' that lie at or below the water surface elevation.
'
' Uses the actual slope-distance along the ground, not horizontal projection.
' -----------------------------------------------------------------------------
Public Function CalcWettedPerimeter( _
    stations() As Double, _
    elevations() As Double, _
    nPts As Long, _
    wsel As Double) As Double

    Dim perim As Double
    perim = 0#

    Dim i As Long
    Dim cx1 As Double, cz1 As Double, cx2 As Double, cz2 As Double

    For i = 0 To nPts - 2
        If ClipSegmentToWSEL(stations(i), elevations(i), stations(i + 1), elevations(i + 1), _
                             wsel, cx1, cz1, cx2, cz2) Then
            Dim dx As Double, dz As Double
            dx = cx2 - cx1
            dz = cz2 - cz1
            perim = perim + Sqr(dx * dx + dz * dz)
        End If
    Next i

    CalcWettedPerimeter = perim
End Function

' -----------------------------------------------------------------------------
' CalcTopWidth
'
' Computes the top width (ft) of the water surface — the horizontal distance
' between the leftmost and rightmost points where the water surface intersects
' (or meets) the ground profile.
' -----------------------------------------------------------------------------
Public Function CalcTopWidth( _
    stations() As Double, _
    elevations() As Double, _
    nPts As Long, _
    wsel As Double) As Double

    Dim leftStation As Double
    Dim rightStation As Double
    Dim foundLeft As Boolean
    Dim foundRight As Boolean

    leftStation = 1E+30
    rightStation = -1E+30
    foundLeft = False
    foundRight = False

    Dim i As Long
    Dim cx1 As Double, cz1 As Double, cx2 As Double, cz2 As Double

    For i = 0 To nPts - 2
        If ClipSegmentToWSEL(stations(i), elevations(i), stations(i + 1), elevations(i + 1), _
                             wsel, cx1, cz1, cx2, cz2) Then
            If cx1 < leftStation Then
                leftStation = cx1
                foundLeft = True
            End If
            If cx2 > rightStation Then
                rightStation = cx2
                foundRight = True
            End If
        End If
    Next i

    If foundLeft And foundRight Then
        CalcTopWidth = rightStation - leftStation
    Else
        CalcTopWidth = 0#
    End If
End Function

' -----------------------------------------------------------------------------
' CalcHydraulicRadius
'
' Computes the hydraulic radius (ft) = Flow Area / Wetted Perimeter.
' Returns 0 if the wetted perimeter is zero (dry section).
' -----------------------------------------------------------------------------
Public Function CalcHydraulicRadius( _
    stations() As Double, _
    elevations() As Double, _
    nPts As Long, _
    wsel As Double) As Double

    Dim A As Double, P As Double
    A = CalcFlowArea(stations, elevations, nPts, wsel)
    P = CalcWettedPerimeter(stations, elevations, nPts, wsel)

    If P <= 0# Then
        CalcHydraulicRadius = 0#
    Else
        CalcHydraulicRadius = A / P
    End If
End Function

' -----------------------------------------------------------------------------
' CalcConveyance
'
' Computes total conveyance K (cfs) using Manning's equation:
'   K = (1.486 / n) * A * R^(2/3)
'
' The cross-section is split into three subsections by bank station indices:
'   - Left overbank:  points 0 .. leftBankIdx
'   - Main channel:   points leftBankIdx .. rightBankIdx
'   - Right overbank: points rightBankIdx .. nPts-1
'
' Each subsection uses the average Manning's n over its wetted ground segments
' weighted by segment length (length-weighted harmonic mean of n would be more
' rigorous, but area-weighted arithmetic mean is standard for HEC-RAS style).
' Here we use the n value at the left point of each segment (step-function n).
'
' Parameters:
'   manningsN()   - n value associated with each station (same length as stations)
'   leftBankIdx   - 0-based index of left bank station in the arrays
'   rightBankIdx  - 0-based index of right bank station in the arrays
' -----------------------------------------------------------------------------
Public Function CalcConveyance( _
    stations() As Double, _
    elevations() As Double, _
    manningsN() As Double, _
    nPts As Long, _
    wsel As Double, _
    leftBankIdx As Long, _
    rightBankIdx As Long) As Double

    Dim totalK As Double
    totalK = 0#

    ' --- Process each of the three subsections ---
    Dim subStart As Long, subEnd As Long
    Dim subSection As Integer  ' 0=LOB, 1=channel, 2=ROB

    For subSection = 0 To 2
        Select Case subSection
            Case 0 : subStart = 0           : subEnd = leftBankIdx
            Case 1 : subStart = leftBankIdx : subEnd = rightBankIdx
            Case 2 : subStart = rightBankIdx : subEnd = nPts - 1
        End Select

        Dim subCount As Long
        subCount = subEnd - subStart + 1

        If subCount < 2 Then GoTo NextSubSection

        ' Extract subsection arrays
        Dim subSta() As Double, subElev() As Double, subN() As Double
        ReDim subSta(0 To subCount - 1)
        ReDim subElev(0 To subCount - 1)
        ReDim subN(0 To subCount - 1)

        Dim j As Long
        For j = 0 To subCount - 1
            subSta(j) = stations(subStart + j)
            subElev(j) = elevations(subStart + j)
            subN(j) = manningsN(subStart + j)
        Next j

        ' Compute A and R for this subsection
        Dim subA As Double, subP As Double, subR As Double
        subA = CalcFlowArea(subSta, subElev, subCount, wsel)
        subP = CalcWettedPerimeter(subSta, subElev, subCount, wsel)

        If subP <= 0# Or subA <= 0# Then GoTo NextSubSection

        subR = subA / subP

        ' Compute length-weighted average n for this subsection
        ' Weight each segment's n by its wetted ground length
        Dim totalWtN As Double, totalWtLen As Double
        totalWtN = 0#
        totalWtLen = 0#

        Dim k As Long
        Dim cx1 As Double, cz1 As Double, cx2 As Double, cz2 As Double

        For k = 0 To subCount - 2
            If ClipSegmentToWSEL(subSta(k), subElev(k), subSta(k + 1), subElev(k + 1), _
                                 wsel, cx1, cz1, cx2, cz2) Then
                Dim segLen As Double
                segLen = Sqr((cx2 - cx1) ^ 2 + (cz2 - cz1) ^ 2)
                ' Use the n at the left station of the original segment
                totalWtN = totalWtN + subN(k) * segLen
                totalWtLen = totalWtLen + segLen
            End If
        Next k

        If totalWtLen <= 0# Then GoTo NextSubSection

        Dim avgN As Double
        avgN = totalWtN / totalWtLen

        If avgN <= 0# Then GoTo NextSubSection

        ' Manning's conveyance: K = (1.486/n) * A * R^(2/3)
        Dim subK As Double
        subK = (1.486 / avgN) * subA * (subR ^ (2# / 3#))
        totalK = totalK + subK

NextSubSection:
    Next subSection

    CalcConveyance = totalK
End Function
