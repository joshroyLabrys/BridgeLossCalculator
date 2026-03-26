Attribute VB_Name = "mod_Charts"
Option Explicit

' =============================================================================
' mod_Charts.bas
' Chart generation for Bridge Loss Calculator — Summary sheet plots
'
' Three charts are produced on the "Summary & Charts" sheet:
'   1. Cross-Section Profile with Bridge  (XY line, row 100 temp data)
'   2. Head Loss Comparison by Method     (clustered column, row 120 temp data)
'   3. Upstream WSEL vs Discharge         (line chart, row 140 temp data)
'
' All worksheet/chart references use late-bound As Object to avoid
' dependency on a specific Excel type library version.
' =============================================================================

' -----------------------------------------------------------------------------
' GenerateAllCharts
'
' Entry point.  Clears any existing ChartObjects on the Summary sheet, reads
' the cross-section data from the Input sheet, then calls all three chart
' generators.
'
' Parameters:
'   wb  — the workbook object (early or late bound)
' -----------------------------------------------------------------------------
Public Sub GenerateAllCharts(wb As Object)

    Dim wsSummary As Object
    Set wsSummary = wb.Sheets("Summary & Charts")

    ' --- Delete existing ChartObjects on Summary sheet ---
    Dim co As Object
    For Each co In wsSummary.ChartObjects
        co.Delete
    Next co

    ' --- Read cross-section data from Input sheet ---
    Dim wsInput As Object
    Set wsInput = wb.Sheets("Input")

    Dim stations()   As Double
    Dim elevations() As Double
    Dim manningsN()  As Double
    Dim nPts         As Long
    Call ReadCrossSection(wsInput, stations, elevations, manningsN, nPts)

    ' --- Dispatch to individual chart builders ---
    Call GenerateCrossSectionChart(wb, stations, elevations, nPts)
    Call GenerateHeadLossBarChart(wb)
    Call GenerateWSELLineChart(wb)

End Sub

' -----------------------------------------------------------------------------
' GenerateCrossSectionChart
'
' Creates a line chart (ChartType 4 = xlLine) on the Summary sheet showing the
' river cross-section profile overlaid with the bridge low chord and high chord.
'
' Data layout (temp range starting at row 100 on Summary sheet):
'   Col 1 = Station (ft)
'   Col 2 = Elevation (ft)
'
' Bridge geometry is read from the Input sheet and plotted as two 2-point
' horizontal lines at the bridge abutment stations:
'   Low chord  — average of left and right low chord elevations, gray
'   High chord — high chord elevation, darker gray
'
' Parameters:
'   wb         — workbook object
'   stations() — XS station array (0-based, nPts elements)
'   elevations()— XS elevation array (0-based, nPts elements)
'   nPts       — number of cross-section points
' -----------------------------------------------------------------------------
Public Sub GenerateCrossSectionChart( _
    wb As Object, _
    stations() As Double, _
    elevations() As Double, _
    nPts As Long)

    Dim wsSummary As Object
    Set wsSummary = wb.Sheets("Summary & Charts")

    ' -------------------------------------------------------------------------
    ' Write XS data to temp range at row 100, columns 1-2
    ' -------------------------------------------------------------------------
    Dim dataRow As Long
    dataRow = 100
    Dim i As Long
    For i = 0 To nPts - 1
        wsSummary.Cells(dataRow + i, 1).Value = stations(i)
        wsSummary.Cells(dataRow + i, 2).Value = elevations(i)
    Next i

    ' -------------------------------------------------------------------------
    ' Read bridge geometry for chord overlays
    ' -------------------------------------------------------------------------
    Dim wsInput As Object
    Set wsInput = wb.Sheets("Input")

    Dim bridgeLeftSta  As Double, bridgeRightSta As Double
    Dim lowChordLeft   As Double, lowChordRight  As Double
    Dim highChord      As Double, skewAngle      As Double
    Call ReadBridgeGeometry(wsInput, bridgeLeftSta, bridgeRightSta, _
                            lowChordLeft, lowChordRight, highChord, skewAngle)

    Dim avgLowChord As Double
    avgLowChord = (lowChordLeft + lowChordRight) / 2#

    ' Write low chord data at row 100 + nPts, cols 4-5
    Dim lcRow As Long
    lcRow = dataRow + nPts
    wsSummary.Cells(lcRow, 4).Value = bridgeLeftSta
    wsSummary.Cells(lcRow, 5).Value = avgLowChord
    wsSummary.Cells(lcRow + 1, 4).Value = bridgeRightSta
    wsSummary.Cells(lcRow + 1, 5).Value = avgLowChord

    ' Write high chord data at row 100 + nPts + 2, cols 4-5
    Dim hcRow As Long
    hcRow = lcRow + 2
    wsSummary.Cells(hcRow, 4).Value = bridgeLeftSta
    wsSummary.Cells(hcRow, 5).Value = highChord
    wsSummary.Cells(hcRow + 1, 4).Value = bridgeRightSta
    wsSummary.Cells(hcRow + 1, 5).Value = highChord

    ' -------------------------------------------------------------------------
    ' Create chart object on Summary sheet
    ' -------------------------------------------------------------------------
    Dim co As Object
    Set co = wsSummary.ChartObjects.Add(Left:=10, Top:=680, Width:=600, Height:=350)

    Dim cht As Object
    Set cht = co.Chart

    ' Remove default series
    Do While cht.SeriesCollection.Count > 0
        cht.SeriesCollection(1).Delete
    Loop

    cht.ChartType = 4   ' xlLine

    ' -------------------------------------------------------------------------
    ' Series 1: Cross-section ground profile
    ' -------------------------------------------------------------------------
    Dim xsRange   As Object
    Dim elevRange As Object
    Set xsRange   = wsSummary.Range(wsSummary.Cells(dataRow, 1), _
                                    wsSummary.Cells(dataRow + nPts - 1, 1))
    Set elevRange = wsSummary.Range(wsSummary.Cells(dataRow, 2), _
                                    wsSummary.Cells(dataRow + nPts - 1, 2))

    Dim sXS As Object
    Set sXS = cht.SeriesCollection.NewSeries
    sXS.Name   = "Ground Profile"
    sXS.XValues = xsRange
    sXS.Values  = elevRange
    sXS.Border.Color  = RGB(33, 33, 33)
    sXS.Border.Weight = 2

    ' -------------------------------------------------------------------------
    ' Series 2: Low chord (gray line)
    ' -------------------------------------------------------------------------
    Dim lcXRange  As Object
    Dim lcYRange  As Object
    Set lcXRange  = wsSummary.Range(wsSummary.Cells(lcRow, 4), _
                                    wsSummary.Cells(lcRow + 1, 4))
    Set lcYRange  = wsSummary.Range(wsSummary.Cells(lcRow, 5), _
                                    wsSummary.Cells(lcRow + 1, 5))

    Dim sLC As Object
    Set sLC = cht.SeriesCollection.NewSeries
    sLC.Name   = "Low Chord"
    sLC.XValues = lcXRange
    sLC.Values  = lcYRange
    sLC.Border.Color  = RGB(120, 144, 156)
    sLC.Border.Weight = 3

    ' -------------------------------------------------------------------------
    ' Series 3: High chord (darker gray line)
    ' -------------------------------------------------------------------------
    Dim hcXRange  As Object
    Dim hcYRange  As Object
    Set hcXRange  = wsSummary.Range(wsSummary.Cells(hcRow, 4), _
                                    wsSummary.Cells(hcRow + 1, 4))
    Set hcYRange  = wsSummary.Range(wsSummary.Cells(hcRow, 5), _
                                    wsSummary.Cells(hcRow + 1, 5))

    Dim sHC As Object
    Set sHC = cht.SeriesCollection.NewSeries
    sHC.Name   = "High Chord"
    sHC.XValues = hcXRange
    sHC.Values  = hcYRange
    sHC.Border.Color  = RGB(96, 125, 139)
    sHC.Border.Weight = 3

    ' -------------------------------------------------------------------------
    ' Chart formatting
    ' -------------------------------------------------------------------------
    cht.HasTitle = True
    cht.ChartTitle.Text = "Cross-Section Profile with Bridge"

    cht.Axes(1).HasTitle = True   ' xlCategory = 1
    cht.Axes(1).AxisTitle.Text = "Station (ft)"

    cht.Axes(2).HasTitle = True   ' xlValue = 2
    cht.Axes(2).AxisTitle.Text = "Elevation (ft)"

End Sub

' -----------------------------------------------------------------------------
' GenerateHeadLossBarChart
'
' Creates a clustered column chart (ChartType 57 = xlColumnClustered) on the
' Summary sheet comparing head loss from all four method sheets.
'
' Data layout (temp range at row 120 on Summary sheet):
'   Row 120 header: col 2="Energy Method", col 3="Momentum Method",
'                   col 4="Yarnell", col 5="WSPRO"
'   Rows 121+: col 1=profile name, cols 2-5 = head loss per method
'
' Head loss is read from row 80 of each method sheet (resRow + 3 = 77+3 = 80),
' columns 2+ (profile 0 in col 2, profile 1 in col 3, …).
'
' Parameters:
'   wb  — workbook object
' -----------------------------------------------------------------------------
Public Sub GenerateHeadLossBarChart(wb As Object)

    Dim wsSummary As Object
    Set wsSummary = wb.Sheets("Summary & Charts")

    ' Method sheet names and their chart series colors
    Dim methodNames(0 To 3) As String
    methodNames(0) = "Energy Method"
    methodNames(1) = "Momentum Method"
    methodNames(2) = "Yarnell"
    methodNames(3) = "WSPRO"

    Dim methodColors(0 To 3) As Long
    methodColors(0) = RGB(66,  165, 245)   ' Energy    — blue
    methodColors(1) = RGB(102, 187, 106)   ' Momentum  — green
    methodColors(2) = RGB(255, 167,  38)   ' Yarnell   — amber
    methodColors(3) = RGB(171,  71, 188)   ' WSPRO     — purple

    ' -------------------------------------------------------------------------
    ' Read profile names and head loss values from the Energy Method sheet
    ' (profiles are consistent across methods; use Energy for names)
    ' Row 78 = profile names (resRow + 1),  Row 80 = head loss (resRow + 3)
    ' -------------------------------------------------------------------------
    Dim wsInput As Object
    Set wsInput = wb.Sheets("Input")

    Dim profileNames()  As String
    Dim profileQ()      As Double
    Dim profileDSWSEL() As Double
    Dim nProfiles       As Long
    Call ReadFlowProfiles(wsInput, profileNames, profileQ, profileDSWSEL, nProfiles)

    ' -------------------------------------------------------------------------
    ' Write temp data block at row 120
    ' -------------------------------------------------------------------------
    Dim headerRow As Long
    headerRow = 120
    Dim dataStartRow As Long
    dataStartRow = 121

    ' Header row: method names in columns 2-5
    Dim m As Long
    For m = 0 To 3
        wsSummary.Cells(headerRow, 2 + m).Value = methodNames(m)
    Next m

    ' Data rows: profile name in col 1, head loss per method in cols 2-5
    Dim p As Long
    For p = 0 To nProfiles - 1
        wsSummary.Cells(dataStartRow + p, 1).Value = profileNames(p)

        For m = 0 To 3
            Dim wsMethod As Object
            Set wsMethod = wb.Sheets(methodNames(m))
            ' Row 80 = resRow + 3 = head loss; data col = 2 + p
            Dim hlVal As Variant
            hlVal = wsMethod.Cells(80, 2 + p).Value
            If IsNumeric(hlVal) Then
                wsSummary.Cells(dataStartRow + p, 2 + m).Value = CDbl(hlVal)
            Else
                wsSummary.Cells(dataStartRow + p, 2 + m).Value = 0
            End If
        Next m
    Next p

    ' -------------------------------------------------------------------------
    ' Create chart
    ' -------------------------------------------------------------------------
    Dim co As Object
    Set co = wsSummary.ChartObjects.Add(Left:=10, Top:=1050, Width:=600, Height:=300)

    Dim cht As Object
    Set cht = co.Chart

    Do While cht.SeriesCollection.Count > 0
        cht.SeriesCollection(1).Delete
    Loop

    cht.ChartType = 57   ' xlColumnClustered

    ' Add one series per method
    For m = 0 To 3
        ' Y values: head loss column for this method
        Dim yRange As Object
        Set yRange = wsSummary.Range( _
            wsSummary.Cells(dataStartRow, 2 + m), _
            wsSummary.Cells(dataStartRow + nProfiles - 1, 2 + m))

        ' Category labels (profile names)
        Dim catRange As Object
        Set catRange = wsSummary.Range( _
            wsSummary.Cells(dataStartRow, 1), _
            wsSummary.Cells(dataStartRow + nProfiles - 1, 1))

        Dim s As Object
        Set s = cht.SeriesCollection.NewSeries
        s.Name      = methodNames(m)
        s.Values    = yRange
        s.XValues   = catRange
        s.Interior.Color = methodColors(m)
    Next m

    ' -------------------------------------------------------------------------
    ' Chart formatting
    ' -------------------------------------------------------------------------
    cht.HasTitle = True
    cht.ChartTitle.Text = "Head Loss Comparison by Method"

    cht.Axes(1).HasTitle = True
    cht.Axes(1).AxisTitle.Text = "Flow Profile"

    cht.Axes(2).HasTitle = True
    cht.Axes(2).AxisTitle.Text = "Head Loss (ft)"

End Sub

' -----------------------------------------------------------------------------
' GenerateWSELLineChart
'
' Creates a line chart (ChartType 4 = xlLine) on the Summary sheet showing
' upstream WSEL vs discharge for all four methods.
'
' Data layout (temp range at row 140 on Summary sheet):
'   Row 140 header: col 1="Q (cfs)", col 2-5 = method names
'   Rows 141+: col 1 = Q, cols 2-5 = US WSEL per method
'
' US WSEL is read from row 79 of each method sheet (resRow + 2 = 77+2 = 79),
' columns 2+ (profile 0 in col 2, profile 1 in col 3, …).
' Q values are read from the Input sheet via ReadFlowProfiles.
'
' Parameters:
'   wb  — workbook object
' -----------------------------------------------------------------------------
Public Sub GenerateWSELLineChart(wb As Object)

    Dim wsSummary As Object
    Set wsSummary = wb.Sheets("Summary & Charts")

    ' Method sheet names and series colors (same order as bar chart)
    Dim methodNames(0 To 3) As String
    methodNames(0) = "Energy Method"
    methodNames(1) = "Momentum Method"
    methodNames(2) = "Yarnell"
    methodNames(3) = "WSPRO"

    Dim methodColors(0 To 3) As Long
    methodColors(0) = RGB(66,  165, 245)   ' Energy    — blue
    methodColors(1) = RGB(102, 187, 106)   ' Momentum  — green
    methodColors(2) = RGB(255, 167,  38)   ' Yarnell   — amber
    methodColors(3) = RGB(171,  71, 188)   ' WSPRO     — purple

    ' -------------------------------------------------------------------------
    ' Read Q values from Input sheet
    ' -------------------------------------------------------------------------
    Dim wsInput As Object
    Set wsInput = wb.Sheets("Input")

    Dim profileNames()  As String
    Dim profileQ()      As Double
    Dim profileDSWSEL() As Double
    Dim nProfiles       As Long
    Call ReadFlowProfiles(wsInput, profileNames, profileQ, profileDSWSEL, nProfiles)

    ' -------------------------------------------------------------------------
    ' Write temp data block at row 140
    ' -------------------------------------------------------------------------
    Dim headerRow As Long
    headerRow = 140
    Dim dataStartRow As Long
    dataStartRow = 141

    ' Header
    wsSummary.Cells(headerRow, 1).Value = "Q (cfs)"
    Dim m As Long
    For m = 0 To 3
        wsSummary.Cells(headerRow, 2 + m).Value = methodNames(m)
    Next m

    ' Data rows
    Dim p As Long
    For p = 0 To nProfiles - 1
        wsSummary.Cells(dataStartRow + p, 1).Value = profileQ(p)

        For m = 0 To 3
            Dim wsMethod As Object
            Set wsMethod = wb.Sheets(methodNames(m))
            ' Row 79 = resRow + 2 = US WSEL; data col = 2 + p
            Dim wselVal As Variant
            wselVal = wsMethod.Cells(79, 2 + p).Value
            If IsNumeric(wselVal) Then
                wsSummary.Cells(dataStartRow + p, 2 + m).Value = CDbl(wselVal)
            Else
                wsSummary.Cells(dataStartRow + p, 2 + m).Value = 0
            End If
        Next m
    Next p

    ' -------------------------------------------------------------------------
    ' Create chart
    ' -------------------------------------------------------------------------
    Dim co As Object
    Set co = wsSummary.ChartObjects.Add(Left:=10, Top:=1370, Width:=600, Height:=300)

    Dim cht As Object
    Set cht = co.Chart

    Do While cht.SeriesCollection.Count > 0
        cht.SeriesCollection(1).Delete
    Loop

    cht.ChartType = 4   ' xlLine

    ' X values (Q) shared across all series
    Dim qRange As Object
    Set qRange = wsSummary.Range( _
        wsSummary.Cells(dataStartRow, 1), _
        wsSummary.Cells(dataStartRow + nProfiles - 1, 1))

    ' One series per method
    For m = 0 To 3
        Dim yRange As Object
        Set yRange = wsSummary.Range( _
            wsSummary.Cells(dataStartRow, 2 + m), _
            wsSummary.Cells(dataStartRow + nProfiles - 1, 2 + m))

        Dim s As Object
        Set s = cht.SeriesCollection.NewSeries
        s.Name    = methodNames(m)
        s.XValues = qRange
        s.Values  = yRange
        s.Border.Color  = methodColors(m)
        s.Border.Weight = 2
    Next m

    ' -------------------------------------------------------------------------
    ' Chart formatting
    ' -------------------------------------------------------------------------
    cht.HasTitle = True
    cht.ChartTitle.Text = "Upstream WSEL vs Discharge"

    cht.Axes(1).HasTitle = True
    cht.Axes(1).AxisTitle.Text = "Discharge Q (cfs)"

    cht.Axes(2).HasTitle = True
    cht.Axes(2).AxisTitle.Text = "Upstream WSEL (ft)"

End Sub
