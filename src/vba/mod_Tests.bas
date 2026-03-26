Attribute VB_Name = "mod_Tests"
Option Explicit

' =============================================================================
' mod_Tests.bas
' Test harness for Bridge Loss Calculator VBA modules
'
' Usage: Run TestAll from the Immediate window or assign to a button.
' Results are printed to the Immediate window (Ctrl+G in the VBE).
' =============================================================================

' --- Tolerance constants ---
Private Const DEFAULT_TOL As Double = 0.001

' -----------------------------------------------------------------------------
' Assert
' Compares two Double values within a tolerance.
' Prints PASS or FAIL with the test name and details.
' -----------------------------------------------------------------------------
Private Sub Assert(testName As String, expected As Double, actual As Double, Optional tol As Double = DEFAULT_TOL)
    If Abs(actual - expected) <= tol Then
        Debug.Print "    PASS: " & testName
    Else
        Debug.Print "    FAIL: " & testName & _
                    " | Expected=" & Format(expected, "0.000") & _
                    " Actual=" & Format(actual, "0.000") & _
                    " Diff=" & Format(Abs(actual - expected), "0.000")
    End If
End Sub

' -----------------------------------------------------------------------------
' AssertStr
' Compares two String values (case-sensitive).
' Prints PASS or FAIL with the test name and details.
' -----------------------------------------------------------------------------
Private Sub AssertStr(testName As String, expected As String, actual As String)
    If expected = actual Then
        Debug.Print "    PASS: " & testName
    Else
        Debug.Print "    FAIL: " & testName & _
                    " | Expected=""" & expected & _
                    """ Actual=""" & actual & """"
    End If
End Sub

' -----------------------------------------------------------------------------
' TestAll
' Entry point — runs every test suite in sequence.
' -----------------------------------------------------------------------------
Public Sub TestAll()
    Debug.Print "===== Bridge Loss Calculator Test Suite ====="
    Debug.Print ""

    TestGeometry
    TestBridgeGeometry
    TestHydraulics
    TestIteration
    TestYarnell
    TestEnergy
    TestMomentum
    TestWSPRO

    Debug.Print ""
    Debug.Print "===== Test Suite Complete ====="
End Sub

' -----------------------------------------------------------------------------
' TestGeometry
' Tests mod_Geometry functions against a simple V-shaped channel.
'
' Cross-section:
'   Station:   0    50   100
'   Elevation: 10    0    10
'
' WSEL = 8 ft
' At WSEL=8: left bank intersection sta=10, right bank intersection sta=90
'
' Expected results:
'   Flow area         = 320.0 sq ft    (tol 0.01)
'   Wetted perimeter  =  81.58 ft      (tol 0.01)
'   Top width         =  80.0 ft       (tol 0.01)
'   Hydraulic radius  =   3.923 ft     (tol 0.001)
'   Conveyance (n=0.035) ~ 33,815 cfs  (tol 200)
' -----------------------------------------------------------------------------
Public Sub TestGeometry()
    Debug.Print "----- TestGeometry -----"

    ' Define V-shaped cross-section
    Dim sta(0 To 2) As Double
    Dim elev(0 To 2) As Double
    Dim nArr(0 To 2) As Double

    sta(0) = 0# : elev(0) = 10# : nArr(0) = 0.035
    sta(1) = 50# : elev(1) = 0#  : nArr(1) = 0.035
    sta(2) = 100# : elev(2) = 10# : nArr(2) = 0.035

    Dim nPts As Long
    nPts = 3

    Dim wsel As Double
    wsel = 8#

    ' Flow area
    Dim A As Double
    A = CalcFlowArea(sta, elev, nPts, wsel)
    Assert "Flow area = 320 sq ft", 320#, A, 0.01

    ' Wetted perimeter
    ' Each leg: sqrt((50-10)^2 + (0-8)^2) = sqrt(1600+64) = sqrt(1664) = 40.7919...
    ' Total = 2 * 40.7919... = 81.5838...
    Dim P As Double
    P = CalcWettedPerimeter(sta, elev, nPts, wsel)
    Assert "Wetted perimeter ~ 81.58 ft", 81.58#, P, 0.01

    ' Top width
    Dim TW As Double
    TW = CalcTopWidth(sta, elev, nPts, wsel)
    Assert "Top width = 80 ft", 80#, TW, 0.01

    ' Hydraulic radius
    Dim R As Double
    R = CalcHydraulicRadius(sta, elev, nPts, wsel)
    Assert "Hydraulic radius ~ 3.923 ft", 3.923#, R, 0.001

    ' Conveyance — single channel section (bank indices span entire XS)
    ' K = (1.486/0.035) * 320 * (320/81.584)^(2/3)
    '   = 42.4571 * 320 * 3.923^(2/3)
    '   = 42.4571 * 320 * 2.4942 ~ 33,880 (within tol 200 of 33,815)
    Dim K As Double
    K = CalcConveyance(sta, elev, nArr, nPts, wsel, 0, 2)
    Assert "Conveyance ~ 33815 (tol 200)", 33815#, K, 200#

    Debug.Print "  TestGeometry tests complete."
    Debug.Print ""
End Sub

' -----------------------------------------------------------------------------
' Placeholder stubs for future test suites
' -----------------------------------------------------------------------------

Public Sub TestBridgeGeometry()
    Debug.Print "----- TestBridgeGeometry -----"
    Debug.Print "  TestBridgeGeometry tests complete."
    Debug.Print ""
End Sub

Public Sub TestHydraulics()
    Debug.Print "----- TestHydraulics -----"
    Debug.Print "  TestHydraulics tests complete."
    Debug.Print ""
End Sub

Public Sub TestIteration()
    Debug.Print "----- TestIteration -----"
    Debug.Print "  TestIteration tests complete."
    Debug.Print ""
End Sub

Public Sub TestYarnell()
    Debug.Print "----- TestYarnell -----"
    Debug.Print "  TestYarnell tests complete."
    Debug.Print ""
End Sub

Public Sub TestEnergy()
    Debug.Print "----- TestEnergy -----"
    Debug.Print "  TestEnergy tests complete."
    Debug.Print ""
End Sub

Public Sub TestMomentum()
    Debug.Print "----- TestMomentum -----"
    Debug.Print "  TestMomentum tests complete."
    Debug.Print ""
End Sub

Public Sub TestWSPRO()
    Debug.Print "----- TestWSPRO -----"
    Debug.Print "  TestWSPRO tests complete."
    Debug.Print ""
End Sub
