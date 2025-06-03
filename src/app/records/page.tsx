
'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import PageLayout from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Download, Trash2, ListOrdered, ArrowLeft, CircleX, ChevronDown, FileText } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import * as XLSX from 'xlsx';

interface MeasurementRecord {
  id: string;
  timestamp: string;
  serialNumber: string;
  deviceName: string;
  deviceType: string; // 'thermometer' | 'alcotest'
  verifierName: string;
  selectedPointLabel: string;
  selectedPointValue: string;
  correction: number;
  measurements: number[];
  averageMeasurement: number;
  correctedAverageMeasurement: number;
  lowerLimit: number;
  upperLimit: number;
  result: 'ГОДЕН' | 'БРАК';
}

interface RowOption {
  value: string;
  label: string;
  correction: number;
  lowerLimit: number;
  upperLimit: number;
}

const ROW_OPTIONS_THERMOMETER: RowOption[] = [
  { value: "32.3", label: "32.3 °C", correction: -4.0, lowerLimit: 32.0, upperLimit: 32.6 },
  { value: "34.8", label: "34.8 °C", correction: -2.2, lowerLimit: 34.5, upperLimit: 35.1 },
  { value: "37.0", label: "37.0 °C", correction: -3.7, lowerLimit: 36.7, upperLimit: 37.3 },
];

const ROW_OPTIONS_ALCOTEST: RowOption[] = [
  { value: "0.000", label: "0.000 мг/л", correction: 0, lowerLimit: 0.000, upperLimit: 0.050 },
  { value: "0.150", label: "0.150 мг/л", correction: 0, lowerLimit: 0.100, upperLimit: 0.200 },
  { value: "0.475", label: "0.475 мг/л", correction: 0, lowerLimit: 0.425, upperLimit: 0.525 },
  { value: "0.850", label: "0.850 мг/л", correction: 0, lowerLimit: 0.765, upperLimit: 0.935 },
  { value: "1.500", label: "1.500 мг/л", correction: 0, lowerLimit: 1.350, upperLimit: 1.650 },
];

const MAX_MEASUREMENTS_DISPLAY = 3;

const getPrecision = (deviceType: string): number => deviceType === 'alcotest' ? 3 : 2;
const getUnit = (deviceType: string): string => deviceType === 'alcotest' ? 'мг/л' : '°C';


function RecordsContent() {
  const [allRecords, setAllRecords] = useState<MeasurementRecord[]>([]);
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const [isDeleteAllOfTypeAlertOpen, setIsDeleteAllOfTypeAlertOpen] = useState(false);
  const [isDeleteSelectedAlertOpen, setIsDeleteSelectedAlertOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'thermometer' | 'alcotest'>('thermometer');
  const [openAccordionItems, setOpenAccordionItems] = useState<string[]>([]);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedRecords = localStorage.getItem('measurementRecords');
      if (storedRecords) {
        try {
          const parsedRecords: MeasurementRecord[] = JSON.parse(storedRecords);
          setAllRecords(parsedRecords.sort((a, b) => {
            if (a.serialNumber < b.serialNumber) return -1;
            if (a.serialNumber > b.serialNumber) return 1;
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
          }));
        } catch (error) {
          console.error("Failed to parse records from localStorage:", error);
          toast({ title: "Ошибка загрузки записей", description: "Не удалось прочитать сохраненные данные.", variant: "destructive" });
          setAllRecords([]);
        }
      }
    }
  }, [toast]);

  const thermometerRecords = allRecords.filter(record => record.deviceType === 'thermometer');
  const alcotestRecords = allRecords.filter(record => record.deviceType === 'alcotest');

  const currentDisplayRecords = activeTab === 'thermometer' ? thermometerRecords : alcotestRecords;
  const currentDeviceTypeName = activeTab === 'thermometer' ? 'Термометры' : 'Алкотестеры';


  const handleDownloadExcel = () => {
    if (allRecords.length === 0) {
      toast({ title: "Нет данных", description: "Нет записей для скачивания.", variant: "default" });
      return;
    }

    const headers = [
      "Дата и время",
      "Поверитель",
      "Тип устройства",
      "Серийный номер",
      "Точка поверки",
      "Поправка",
      ...Array.from({ length: MAX_MEASUREMENTS_DISPLAY }, (_, i) => `Измерение ${i + 1}`),
      "Среднее изм.",
      "Скорр. среднее",
      "Ниж. предел",
      "Верх. предел",
      "Результат (Вывод)"
    ];
    
    const dataForSheet = allRecords.map(record => {
      const measurementCells = Array.from({ length: MAX_MEASUREMENTS_DISPLAY }, (_, i) =>
        record.measurements[i] !== undefined ? record.measurements[i] : null
      );
      return [
        format(new Date(record.timestamp), "dd.MM.yyyy HH:mm:ss", { locale: ru }),
        record.verifierName || 'Не указан',
        record.deviceType === 'thermometer' ? 'Термометр' : 'Алкотестер',
        record.serialNumber,
        record.selectedPointLabel,
        record.correction,
        ...measurementCells,
        record.averageMeasurement,
        record.correctedAverageMeasurement,
        record.lowerLimit,
        record.upperLimit,
        record.result
      ];
    });

    const worksheetData = [headers, ...dataForSheet];
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    ws['!cols'] = [
      { wch: 19 }, // Дата и время
      { wch: 15 }, // Поверитель
      { wch: 15 }, // Тип устройства
      { wch: 18 }, // Серийный номер
      { wch: 15 }, // Точка поверки
      { wch: 10 }, // Поправка
      ...Array(MAX_MEASUREMENTS_DISPLAY).fill({ wch: 10 }), // Измерения
      { wch: 12, hidden: true }, // Среднее изм.
      { wch: 12, hidden: true }, // Скорр. среднее
      { wch: 12, hidden: true }, // Ниж. предел
      { wch: 12, hidden: true }, // Верх. предел
      { wch: 15 }  // Результат (Вывод)
    ];
    
    const measurementStartIndex = headers.indexOf("Измерение 1");
    for (let i = 0; i < MAX_MEASUREMENTS_DISPLAY; i++) {
        const colLetter = XLSX.utils.encode_col(measurementStartIndex + i);
        for (let R = 0; R < dataForSheet.length; ++R) { 
            const cellAddress = colLetter + (R + 2); 
            const cell = ws[cellAddress];
            if (cell && typeof cell.v === 'number') {
                const recordIndex = R; 
                const deviceType = allRecords[recordIndex]?.deviceType;
                if(deviceType){
                    const precision = getPrecision(deviceType);
                    cell.z = `0.${'0'.repeat(precision)}`;
                }
            }
        }
    }

    const valueColsToFormatIndices = [headers.indexOf("Поправка"), headers.indexOf("Среднее изм."), headers.indexOf("Скорр. среднее"), headers.indexOf("Ниж. предел"), headers.indexOf("Верх. предел")];
    valueColsToFormatIndices.forEach(colIndex => {
        if (colIndex === -1) return;
        const colLetter = XLSX.utils.encode_col(colIndex);
        for (let R = 0; R < dataForSheet.length; ++R) { 
            const cellAddress = colLetter + (R + 2); 
            const cell = ws[cellAddress];
            if (cell && typeof cell.v === 'number') {
                const recordIndex = R; 
                const deviceType = allRecords[recordIndex]?.deviceType;
                 if(deviceType){
                    const precision = getPrecision(deviceType);
                    cell.z = `0.${'0'.repeat(precision)}`;
                 }
            }
        }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Записи");
    const excelFileName = `records_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`;
    XLSX.writeFile(wb, excelFileName);

    toast({ title: "Загрузка начата", description: `Файл ${excelFileName} с записями загружается.`, variant: "default" });
  };

  const handleGenerateProtocol = (
    serialNumber: string,
    recordsForProtocol: MeasurementRecord[]
  ) => {
    if (!recordsForProtocol || recordsForProtocol.length === 0) {
        toast({ title: "Ошибка", description: "Нет данных для формирования протокола.", variant: "destructive" });
        return;
    }

    const wb = XLSX.utils.book_new();
    const firstRecord = recordsForProtocol[0];
    const deviceName = firstRecord.deviceName;
    const verifierNameParts = (firstRecord.verifierName || " ").split(" ");
    const verifierSurname = verifierNameParts[0] || " ";
    const verifierFirstName = verifierNameParts.length > 1 ? verifierNameParts[1] : " ";
    const verifierPatronymic = verifierNameParts.length > 2 ? verifierNameParts[2] : " ";

    const verificationDate = format(new Date(), "dd.MM.yyyy");

    const ws_data: (string | number | null | XLSX.CellObject)[][] = [];

    const fontArialSize11 = { name: "Arial", sz: 11 };
    const centerAlignment = { horizontal: "center", vertical: "center", wrapText: true };
    const leftAlignment = { horizontal: "left", vertical: "center", wrapText: true };
    const thinBorder = { style: "thin", color: { rgb: "000000" } };
    const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
    
    const lightYellowFill = { patternType: "solid", fgColor: { rgb: "FFF2CC" } }; 
    const lightGreenFill = { patternType: "solid", fgColor: { rgb: "D9EAD3" } };
    
    const headerStyle = { font: { ...fontArialSize11, bold: true, sz:14 }, alignment: centerAlignment, fill: lightYellowFill, border: allBorders };
    const labelStyle = { font: { ...fontArialSize11, bold: true }, alignment: leftAlignment, fill: lightYellowFill, border: allBorders };
    const valueStyle = { font: fontArialSize11, alignment: centerAlignment, fill: lightYellowFill, border: allBorders };
    const emptyYellowCellStyle = { fill: lightYellowFill, border: allBorders };
    
    const tableHeaderStyle = { font: { ...fontArialSize11, bold: true }, fill: lightGreenFill, border: allBorders, alignment: centerAlignment };
    const dataCellStyle = { font: fontArialSize11, border: allBorders, alignment: centerAlignment };
    const dataCellYellowBgStyle = { ...dataCellStyle, fill: lightYellowFill };

    ws_data.push(Array(9).fill(null));
    ws_data.push([null, {v: deviceName, s: headerStyle} , null, null, null, null, null, null, null]);
    ws_data.push(Array(9).fill(null));
    ws_data.push([null, {v: "Рег. № ФИФ по ОЕИ", s: labelStyle}, null, null, null, null, {v: " ", s: valueStyle}, null, null]);
    ws_data.push(Array(9).fill(null));
    ws_data.push([null, {v: "ВВЕДИТЕ СЕРИЙНЫЙ НОМЕР", s: labelStyle}, null, null, null, null, {v: serialNumber, s: valueStyle}, null, null]);
    ws_data.push(Array(9).fill(null));
    ws_data.push([null, {v: "ВВЕДИТЕ ДАТУ ПОВЕРКИ", s: labelStyle}, null, null, null, null, {v: verificationDate, s: valueStyle}, null, null]);
    ws_data.push(Array(9).fill(null));
    
    ws_data.push([
        null, 
        {v: "УКАЖИТЕ Фамилию ИО СТАЖЕРА", s: labelStyle}, 
        {v: verifierSurname, s: valueStyle}, 
        {v: verifierFirstName, s: valueStyle}, 
        {v: verifierPatronymic, s: valueStyle}, 
        {v: " ", s: emptyYellowCellStyle}, 
        {v: " ", s: emptyYellowCellStyle}, 
        null, 
        {v: " ", s: emptyYellowCellStyle}  
    ]);
    
    ws_data.push(Array(9).fill(null));
    ws_data.push([null, {v: "ОСТАВЬТЕ НЕОБХОДИМУЮ МОДИФИКАЦИЮ (удалите лишнее)", s: { ...labelStyle, font: {...fontArialSize11, bold:false}, alignment: { horizontal: "center", vertical: "center", wrapText: true} } }, null, null, null, null, null, null, null]);
    ws_data.push(Array(9).fill(null)); 
    ws_data.push(Array(9).fill(null));
    ws_data.push([null, {v: "1. Результаты определения абсолютной погрешности измерений температуры", s: { font: {...fontArialSize11, bold: true}, alignment: { horizontal: "left", vertical: "center", wrapText:false } }}, null, null, null, null, null, null, null]);
    
    ws_data.push([ 
        null, 
        {v: "Точки поверки, °С", s: tableHeaderStyle}, 
        {v: "Эталонное значение температуры, установленное на КТ-7.АЧТ, °С", s: tableHeaderStyle}, 
        {v: "Температурная поправка, °С", s: tableHeaderStyle}, 
        {v: "Измеренное комплексом значение температуры, °С", s: tableHeaderStyle}, 
        {v: "Среднее значение температуры, измеренное комплексом (с учетом температурной поправки), °С", s: tableHeaderStyle},
        {v: "Пределы допускаемой абсолютной погрешности измерений температуры, °С", s: tableHeaderStyle}, null, 
        {v: "Вывод", s: tableHeaderStyle}
    ]);
    ws_data.push([ 
      null, null, null, null, null, null, 
      {v: "нижний", s: {...tableHeaderStyle, font: {...fontArialSize11, bold: false }}}, 
      {v: "верхний", s: {...tableHeaderStyle, font: {...fontArialSize11, bold: false }}}, 
      null
    ]);

    const sortedRecordsForProtocol = [...recordsForProtocol].sort((a, b) => {
        const aIndex = ROW_OPTIONS_THERMOMETER.findIndex(opt => opt.value === a.selectedPointValue);
        const bIndex = ROW_OPTIONS_THERMOMETER.findIndex(opt => opt.value === b.selectedPointValue);
        return aIndex - bIndex;
    });
    
    let wsDataCurrentRowIndex = 17; 
    const numberFormatOneDecimal = "0.0";

    sortedRecordsForProtocol.forEach(record => {
        const pointLabel = parseFloat(record.selectedPointValue);
        const protocolPrecision = 1; 
        
        for (let i = 0; i < MAX_MEASUREMENTS_DISPLAY; i++) {
            const measuredValueCell: XLSX.CellObject | null = record.measurements[i] !== undefined
                ? { v: parseFloat(record.measurements[i].toFixed(protocolPrecision)), s: dataCellYellowBgStyle, z: numberFormatOneDecimal }
                : { v: null, s: dataCellYellowBgStyle };

            let rowData: (string | number | null | XLSX.CellObject)[];

            if (i === 0) { // Top row of the merge group
                rowData = [
                    null, // A
                    { v: pointLabel, s: dataCellYellowBgStyle, z: numberFormatOneDecimal }, // B
                    { v: parseFloat(record.selectedPointValue), s: dataCellStyle, z: numberFormatOneDecimal }, // C
                    { v: parseFloat(record.correction.toFixed(protocolPrecision)), s: dataCellStyle, z: numberFormatOneDecimal }, // D
                    measuredValueCell, // E
                    { v: parseFloat(record.correctedAverageMeasurement.toFixed(protocolPrecision)), s: dataCellYellowBgStyle, z: numberFormatOneDecimal }, // F
                    { v: parseFloat(record.lowerLimit.toFixed(protocolPrecision)), s: dataCellYellowBgStyle, z: numberFormatOneDecimal }, // G
                    { v: parseFloat(record.upperLimit.toFixed(protocolPrecision)), s: dataCellYellowBgStyle, z: numberFormatOneDecimal }, // H
                    { v: record.result, t: 's', s: dataCellYellowBgStyle } // I
                ];
            } else { // Subsequent rows in the merge group
                rowData = [
                    null, // A
                    null, // B (merged)
                    { v: parseFloat(record.selectedPointValue), s: dataCellStyle, z: numberFormatOneDecimal }, // C (repeated value)
                    { v: parseFloat(record.correction.toFixed(protocolPrecision)), s: dataCellStyle, z: numberFormatOneDecimal }, // D (repeated value)
                    measuredValueCell, // E
                    null, // F (merged)
                    null, // G (merged)
                    null, // H (merged)
                    null  // I (merged)
                ];
            }
            ws_data.push(rowData);
        }
        wsDataCurrentRowIndex += MAX_MEASUREMENTS_DISPLAY;
    });

    const ws = XLSX.utils.aoa_to_sheet(ws_data, { cellStyles: true });

    ws['!merges'] = [
        { s: { r: 1, c: 1 }, e: { r: 1, c: 8 } },  // Device Name
        { s: { r: 3, c: 1 }, e: { r: 3, c: 5 } },  // Рег. № ФИФ по ОЕИ Label
        { s: { r: 3, c: 6 }, e: { r: 3, c: 8 } },  // Рег. № ФИФ по ОЕИ Value
        { s: { r: 5, c: 1 }, e: { r: 5, c: 5 } },  // Серийный номер Label
        { s: { r: 5, c: 6 }, e: { r: 5, c: 8 } },  // Серийный номер Value
        { s: { r: 7, c: 1 }, e: { r: 7, c: 5 } },  // Дата поверки Label
        { s: { r: 7, c: 6 }, e: { r: 7, c: 8 } },  // Дата поверки Value
        
        { s: { r: 9, c: 1 }, e: { r: 9, c: 1 } },  
        { s: { r: 9, c: 2 }, e: { r: 9, c: 2 } },
        { s: { r: 9, c: 3 }, e: { r: 9, c: 3 } },
        { s: { r: 9, c: 4 }, e: { r: 9, c: 4 } },
        { s: { r: 9, c: 5 }, e: { r: 9, c: 5 } }, 
        { s: { r: 9, c: 6 }, e: { r: 9, c: 7 } }, 
        { s: { r: 9, c: 8 }, e: { r: 9, c: 8 } }, 
        
        { s: { r: 11, c: 1 }, e: { r: 12, c: 8 } }, 
        { s: { r: 14, c: 1 }, e: { r: 14, c: 8 } }, 
        
        { s: { r: 15, c: 1 }, e: { r: 16, c: 1 } }, 
        { s: { r: 15, c: 2 }, e: { r: 16, c: 2 } }, 
        { s: { r: 15, c: 3 }, e: { r: 16, c: 3 } }, 
        { s: { r: 15, c: 4 }, e: { r: 16, c: 4 } }, 
        { s: { r: 15, c: 5 }, e: { r: 16, c: 5 } }, 
        { s: { r: 15, c: 6 }, e: { r: 15, c: 7 } }, 
        { s: { r: 15, c: 8 }, e: { r: 16, c: 8 } }, 
    ];

    let mergeDataRowStart = 17; 
    sortedRecordsForProtocol.forEach(() => {
        ws['!merges']?.push({ s: { r: mergeDataRowStart, c: 1 }, e: { r: mergeDataRowStart + MAX_MEASUREMENTS_DISPLAY - 1, c: 1 } }); 
        ws['!merges']?.push({ s: { r: mergeDataRowStart, c: 5 }, e: { r: mergeDataRowStart + MAX_MEASUREMENTS_DISPLAY - 1, c: 5 } }); 
        ws['!merges']?.push({ s: { r: mergeDataRowStart, c: 6 }, e: { r: mergeDataRowStart + MAX_MEASUREMENTS_DISPLAY - 1, c: 6 } }); 
        ws['!merges']?.push({ s: { r: mergeDataRowStart, c: 7 }, e: { r: mergeDataRowStart + MAX_MEASUREMENTS_DISPLAY - 1, c: 7 } }); 
        ws['!merges']?.push({ s: { r: mergeDataRowStart, c: 8 }, e: { r: mergeDataRowStart + MAX_MEASUREMENTS_DISPLAY - 1, c: 8 } }); 
        mergeDataRowStart += MAX_MEASUREMENTS_DISPLAY;
    });
    
    ws['!cols'] = [ 
        { wch: 2 }, { wch: 12 }, { wch: 22 }, { wch: 15 }, { wch: 18 },
        { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 10 }
    ];
    ws['!rows'] = Array(ws_data.length).fill({hpt: 15});
    if(ws['!rows'][1]) ws['!rows'][1].hpt = 20; 
    if(ws['!rows'][11]) ws['!rows'][11] = {hpt: 30}; 
    if(ws['!rows'][12]) ws['!rows'][12] = {hpt: 0.1}; 
    if(ws['!rows'][15]) ws['!rows'][15] = {hpt: 45}; 
    if(ws['!rows'][16]) ws['!rows'][16] = {hpt: 15};

    XLSX.utils.book_append_sheet(wb, ws, "Протокол");
    const excelFileName = `protocol_${serialNumber}_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`;
    XLSX.writeFile(wb, excelFileName);

    toast({ title: "Протокол сформирован", description: `Файл ${excelFileName} загружается.`, variant: "default" });
};


  const handleDeleteAllRecordsOfType = () => {
    if (typeof window !== 'undefined') {
        const remainingRecords = allRecords.filter(record => record.deviceType !== activeTab);
        localStorage.setItem('measurementRecords', JSON.stringify(remainingRecords));
        setAllRecords(remainingRecords);
        const newSelectedRecords = new Set<string>();
        selectedRecords.forEach(id => {
            if (remainingRecords.some(r => r.id === id)) {
                newSelectedRecords.add(id);
            }
        });
        setSelectedRecords(newSelectedRecords);
        toast({ title: `Все записи для "${currentDeviceTypeName}" удалены`, variant: "default" });
    }
    setIsDeleteAllOfTypeAlertOpen(false);
  };

  const handleDeleteSelectedRecords = () => {
    if (typeof window !== 'undefined' && selectedRecords.size > 0) {
        const remainingRecords = allRecords.filter(record => !selectedRecords.has(record.id));
        localStorage.setItem('measurementRecords', JSON.stringify(remainingRecords));
        setAllRecords(remainingRecords);
        const numDeleted = selectedRecords.size;
        setSelectedRecords(new Set());
        toast({
            title: "Выбранные записи удалены",
            description: `${numDeleted} ${numDeleted === 1 ? "запись удалена" : (numDeleted > 1 && numDeleted < 5) ? "записи удалены" : "записей удалено"}.`,
            variant: "default"
        });
    }
    setIsDeleteSelectedAlertOpen(false);
  };

  const toggleRecordSelection = (recordId: string) => {
    setSelectedRecords(prevSelected => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(recordId)) {
        newSelected.delete(recordId);
      } else {
        newSelected.add(recordId);
      }
      return newSelected;
    });
  };

  const toggleSelectAllRecordsForCurrentTab = () => {
    const currentTabRecordIds = new Set(currentDisplayRecords.map(record => record.id));
    const newSelectedRecords = new Set(selectedRecords);
    
    let allOnThisTabSelected = true;
    if (currentTabRecordIds.size === 0) allOnThisTabSelected = false; 
    else {
      for (const id of currentTabRecordIds) {
          if (!selectedRecords.has(id)) {
              allOnThisTabSelected = false;
              break;
          }
      }
    }

    if (allOnThisTabSelected) {
        currentTabRecordIds.forEach(id => newSelectedRecords.delete(id));
    } else { 
        currentTabRecordIds.forEach(id => newSelectedRecords.add(id));
    }
    setSelectedRecords(newSelectedRecords);
  };

  const isAllSelectedForCurrentTab = currentDisplayRecords.length > 0 && currentDisplayRecords.every(record => selectedRecords.has(record.id));

  const renderGroupedRecords = (recordsToDisplay: MeasurementRecord[], deviceTypeTab: 'thermometer' | 'alcotest') => {
    if (recordsToDisplay.length === 0) {
      return (
        <Card className="mt-4">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Нет сохраненных записей для {deviceTypeTab === 'thermometer' ? 'термометров' : 'алкотестеров'}.</p>
          </CardContent>
        </Card>
      );
    }

    const groupedRecords = recordsToDisplay.reduce((acc, record) => {
      if (!acc[record.serialNumber]) {
        acc[record.serialNumber] = {
          details: record, 
          points: [],
          firstTimestamp: record.timestamp,
          deviceName: record.deviceName,
          verifierName: record.verifierName
        };
      }
      acc[record.serialNumber].points.push(record);
      if (new Date(record.timestamp) < new Date(acc[record.serialNumber].firstTimestamp)) {
        acc[record.serialNumber].firstTimestamp = record.timestamp;
      }
      if(record.deviceName) acc[record.serialNumber].deviceName = record.deviceName;
      if(record.verifierName) acc[record.serialNumber].verifierName = record.verifierName;

      acc[record.serialNumber].points.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return acc;
    }, {} as Record<string, { details: MeasurementRecord, points: MeasurementRecord[], firstTimestamp: string, deviceName: string, verifierName: string }>);

    // const unit = getUnit(deviceTypeTab);
    // const precision = getPrecision(deviceTypeTab);

    return (
      <Accordion type="multiple" className="w-full mt-4" value={openAccordionItems} onValueChange={setOpenAccordionItems}>
        {Object.entries(groupedRecords).map(([serialNumber, groupData]) => {
          const deviceRecordsForSN = groupData.points;
          const actualDeviceType = deviceRecordsForSN[0]?.deviceType; 
          const relevantRowOptions = actualDeviceType === 'thermometer' ? ROW_OPTIONS_THERMOMETER : ROW_OPTIONS_ALCOTEST;
          
          const recordedPointValues = new Set(deviceRecordsForSN.map(r => r.selectedPointValue));
          const allPointsForProtocolRecorded = actualDeviceType === 'thermometer' && 
                                               relevantRowOptions.length > 0 && 
                                               relevantRowOptions.every(opt => recordedPointValues.has(opt.value));
          return (
          <AccordionItem value={serialNumber} key={serialNumber} className="border-b">
            <AccordionTrigger className="hover:no-underline p-3 text-left [&[data-state=open]>svg:not(.static-icon)]:rotate-180">
              <div className="flex justify-between items-center w-full">
                <div className="flex-grow">
                  <p className="font-semibold text-primary text-base">{serialNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {groupData.deviceName} / Поверитель: {groupData.verifierName || '–'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Первая запись: {format(new Date(groupData.firstTimestamp), "dd.MM.yy HH:mm", { locale: ru })} / Точек: {groupData.points.length}
                  </p>
                </div>
                <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 static-icon" />
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              {allPointsForProtocolRecorded && actualDeviceType === 'thermometer' && (
                <div className="p-3 border-t">
                  <Button 
                    onClick={() => handleGenerateProtocol(serialNumber, deviceRecordsForSN)}
                    variant="default"
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Сформировать протокол
                  </Button>
                </div>
              )}
              <div className="overflow-x-auto">
                <Table className="bg-background">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead className="min-w-[150px]">Точка поверки</TableHead>
                      {Array.from({ length: MAX_MEASUREMENTS_DISPLAY }, (_, i) => (
                        <TableHead key={`mes-head-${i}`} className="min-w-[80px] text-center">Изм. {i + 1}</TableHead>
                      ))}
                      <TableHead className="min-w-[100px] text-center">Скорр. ср.</TableHead>
                      <TableHead className="min-w-[100px] text-center">Результат</TableHead>
                      <TableHead className="min-w-[120px] text-center">Дата точки</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupData.points.map((record) => (
                      <TableRow
                        key={record.id}
                        className={record.result === 'БРАК' ? 'bg-destructive/10 hover:bg-destructive/20 data-[state=selected]:bg-destructive/20' : 'data-[state=selected]:bg-muted/50'}
                        data-state={selectedRecords.has(record.id) ? "selected" : undefined}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedRecords.has(record.id)}
                            onCheckedChange={() => toggleRecordSelection(record.id)}
                            aria-label={`Выбрать запись ${record.serialNumber} - ${record.selectedPointLabel}`}
                          />
                        </TableCell>
                        <TableCell>{record.selectedPointLabel}</TableCell>
                        {Array.from({ length: MAX_MEASUREMENTS_DISPLAY }, (_, i) => (
                          <TableCell key={`${record.id}-mes-${i}`} className="text-center">
                            {record.measurements[i] !== undefined ? record.measurements[i].toFixed(getPrecision(record.deviceType)).replace('.', ',') : '–'}
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-medium">
                          {record.correctedAverageMeasurement.toFixed(getPrecision(record.deviceType)).replace('.', ',')}
                          {getUnit(record.deviceType)}
                        </TableCell>
                        <TableCell className="text-center">
                           <span className={`px-2 py-0.5 text-xs font-semibold rounded-full whitespace-nowrap ${
                            record.result === 'ГОДЕН' ? 'bg-accent text-accent-foreground' : 'bg-destructive text-destructive-foreground'
                          }`}>
                            {record.result}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {format(new Date(record.timestamp), "dd.MM.yy HH:mm", { locale: ru })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </AccordionContent>
          </AccordionItem>
        )})}
      </Accordion>
    );
  };


  return (
    <PageLayout pageTitle="Журнал записей">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-semibold flex items-center"><ListOrdered className="mr-2 h-6 w-6 text-primary shrink-0" />Сохраненные записи</h2>
          
           <div className="flex flex-col sm:flex-row items-start sm:items-stretch gap-2 w-full sm:w-auto justify-start sm:justify-end flex-wrap">
            <Link href="/" passHref legacyBehavior>
              <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary w-full sm:w-auto">
                <ArrowLeft className="mr-2 h-4 w-4" /> На главную
              </Button>
            </Link>
            <Button
              onClick={handleDownloadExcel}
              disabled={allRecords.length === 0}
              className="bg-accent text-accent-foreground hover:bg-accent/90 w-full sm:w-auto"
            >
              <Download className="mr-2 h-4 w-4" /> Скачать все в Exel
            </Button>
          </div>
        </div>
         <div className="flex flex-col items-stretch space-y-2 sm:flex-row sm:justify-end sm:space-y-0 sm:space-x-2 pt-2">
              <AlertDialog open={isDeleteSelectedAlertOpen} onOpenChange={setIsDeleteSelectedAlertOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={selectedRecords.size === 0} className="w-full sm:w-auto">
                    <CircleX className="mr-2 h-4 w-4" /> Удалить выбранное ({selectedRecords.size})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Подтвердите удаление</AlertDialogTitle>
                    <AlertDialogDescription>
                      Вы уверены, что хотите удалить выбранные ({selectedRecords.size}) записи? Это действие необратимо.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteSelectedRecords}>Удалить</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog open={isDeleteAllOfTypeAlertOpen} onOpenChange={setIsDeleteAllOfTypeAlertOpen}>
                <AlertDialogTrigger asChild>
                   <Button 
                    variant="destructive" 
                    className="w-full sm:w-auto hover:bg-destructive/90"
                    disabled={currentDisplayRecords.length === 0 || selectedRecords.size > 0}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Удалить все
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Подтвердите удаление</AlertDialogTitle>
                    <AlertDialogDescription>
                       Вы уверены, что хотите удалить ВСЕ записи для {currentDeviceTypeName}? Это действие необратимо.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAllRecordsOfType}>Удалить</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

        <Tabs value={activeTab} onValueChange={(value) => { setActiveTab(value as 'thermometer' | 'alcotest'); setOpenAccordionItems([]); setSelectedRecords(new Set()); }} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="thermometer">Термометры ({thermometerRecords.length})</TabsTrigger>
            <TabsTrigger value="alcotest">Алкотестеры ({alcotestRecords.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="thermometer">
            {currentDisplayRecords.length > 0 && (
                <div className="flex items-center py-2 px-1 border-b">
                    <Checkbox
                        id="selectAllThermometer"
                        checked={isAllSelectedForCurrentTab}
                        onCheckedChange={toggleSelectAllRecordsForCurrentTab}
                        aria-label="Выбрать все записи для термометров"
                        disabled={thermometerRecords.length === 0}
                    />
                    <label htmlFor="selectAllThermometer" className="ml-2 text-sm font-medium text-muted-foreground cursor-pointer">
                        Выбрать все ({thermometerRecords.length}) для {currentDeviceTypeName}
                    </label>
                </div>
            )}
            {renderGroupedRecords(thermometerRecords, 'thermometer')}
          </TabsContent>
          <TabsContent value="alcotest">
             {currentDisplayRecords.length > 0 && (
                <div className="flex items-center py-2 px-1 border-b">
                    <Checkbox
                        id="selectAllAlcotest"
                        checked={isAllSelectedForCurrentTab}
                        onCheckedChange={toggleSelectAllRecordsForCurrentTab}
                        aria-label="Выбрать все записи для алкотестеров"
                        disabled={alcotestRecords.length === 0}
                    />
                     <label htmlFor="selectAllAlcotest" className="ml-2 text-sm font-medium text-muted-foreground cursor-pointer">
                        Выбрать все ({alcotestRecords.length}) для {currentDeviceTypeName}
                    </label>
                </div>
            )}
            {renderGroupedRecords(alcotestRecords, 'alcotest')}
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}

export default function RecordsPage() {
  return (
    <Suspense fallback={<PageLayout pageTitle="Загрузка записей..."><div className="text-center py-10"><p className="text-muted-foreground">Загрузка...</p></div></PageLayout>}>
      <RecordsContent />
    </Suspense>
  );
}

