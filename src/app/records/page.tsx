
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
import { Download, Trash2, ListOrdered, ArrowLeft, CircleX, ChevronDown, ChevronRight } from 'lucide-react';
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
          // Sort by serial number, then by timestamp descending within each S/N group
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
  const currentDeviceTypeAdjective = activeTab === 'thermometer' ? 'термометров' : 'алкотестеров';


  const handleDownloadExcel = () => {
    if (allRecords.length === 0) {
      toast({ title: "Нет данных", description: "Нет записей для скачивания.", variant: "default" });
      return;
    }

    const headers = [
      "Дата и время", "Поверитель", "Тип устройства", "Имя устройства", "Серийный номер",
      "Точка поверки", "Значение точки", "Поправка",
      ...Array.from({ length: MAX_MEASUREMENTS_DISPLAY }, (_, i) => `Измерение ${i + 1}`),
      "Среднее изм.", "Скорр. среднее",
      "Ниж. предел", "Верх. предел", "Результат (Вывод)"
    ];

    const dataForSheet = allRecords.map(record => {
      const precision = getPrecision(record.deviceType);
      const measurementCells = Array.from({ length: MAX_MEASUREMENTS_DISPLAY }, (_, i) =>
        record.measurements[i] !== undefined ? record.measurements[i] : null
      );
      return [
        format(new Date(record.timestamp), "dd.MM.yyyy HH:mm:ss", { locale: ru }),
        record.verifierName || 'Не указан',
        record.deviceType === 'thermometer' ? 'Термометр' : 'Алкотестер',
        record.deviceName,
        record.serialNumber,
        record.selectedPointLabel,
        parseFloat(record.selectedPointValue.replace(',', '.')),
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
      { wch: 19 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 },
      { wch: 15 }, { wch: 10 }, { wch: 10 },
      ...Array(MAX_MEASUREMENTS_DISPLAY).fill({ wch: 10 }),
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }
    ];
    
    const measurementStartIndex = 8; 
    for (let i = 0; i < MAX_MEASUREMENTS_DISPLAY; i++) {
        const colLetter = XLSX.utils.encode_col(measurementStartIndex + i);
        for (let R = 1; R <= dataForSheet.length; ++R) {
            const cellAddress = colLetter + (R + 1);
            if (ws[cellAddress] && typeof ws[cellAddress].v === 'number') {
                const recordIndex = R -1;
                const deviceType = allRecords[recordIndex]?.deviceType;
                if(deviceType){
                    const precision = getPrecision(deviceType);
                    ws[cellAddress].z = `0.${'0'.repeat(precision)}`;
                }
            }
        }
    }
    const avgColsIndices = [
        measurementStartIndex + MAX_MEASUREMENTS_DISPLAY, 
        measurementStartIndex + MAX_MEASUREMENTS_DISPLAY + 1, 
        measurementStartIndex + MAX_MEASUREMENTS_DISPLAY + 2, 
        measurementStartIndex + MAX_MEASUREMENTS_DISPLAY + 3, 
    ];
    avgColsIndices.forEach(colIndex => {
        const colLetter = XLSX.utils.encode_col(colIndex);
        for (let R = 1; R <= dataForSheet.length; ++R) {
            const cellAddress = colLetter + (R + 1);
            if (ws[cellAddress] && typeof ws[cellAddress].v === 'number') {
                const recordIndex = R-1;
                const deviceType = allRecords[recordIndex]?.deviceType;
                 if(deviceType){
                    const precision = getPrecision(deviceType);
                    ws[cellAddress].z = `0.${'0'.repeat(precision)}`;
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
    if (currentTabRecordIds.size === 0) allOnThisTabSelected = false; // handle empty tab
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

  const renderGroupedRecords = (recordsToDisplay: MeasurementRecord[], deviceType: 'thermometer' | 'alcotest') => {
    if (recordsToDisplay.length === 0) {
      return (
        <Card className="mt-4">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Нет сохраненных записей для {deviceType === 'thermometer' ? currentDeviceTypeAdjective : currentDeviceTypeAdjective}.</p>
          </CardContent>
        </Card>
      );
    }

    const groupedRecords = recordsToDisplay.reduce((acc, record) => {
      if (!acc[record.serialNumber]) {
        acc[record.serialNumber] = {
          details: record, // Store first record for common details like deviceName, verifierName
          points: [],
          firstTimestamp: record.timestamp
        };
      }
      acc[record.serialNumber].points.push(record);
      if (new Date(record.timestamp) < new Date(acc[record.serialNumber].firstTimestamp)) {
        acc[record.serialNumber].firstTimestamp = record.timestamp;
      }
      // Sort points by timestamp descending
      acc[record.serialNumber].points.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return acc;
    }, {} as Record<string, { details: MeasurementRecord, points: MeasurementRecord[], firstTimestamp: string }>);

    const unit = getUnit(deviceType);
    const precision = getPrecision(deviceType);

    return (
      <Accordion type="multiple" className="w-full mt-4" value={openAccordionItems} onValueChange={setOpenAccordionItems}>
        {Object.entries(groupedRecords).map(([serialNumber, groupData]) => (
          <AccordionItem value={serialNumber} key={serialNumber} className="border-b">
            <AccordionTrigger className="hover:no-underline p-3 text-left [&[data-state=open]>svg:not(.static-icon)]:rotate-180">
              <div className="flex justify-between items-center w-full">
                <div className="flex-grow">
                  <p className="font-semibold text-primary text-base">{serialNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {groupData.details.deviceName} / Поверитель: {groupData.details.verifierName || '–'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Первая запись: {format(new Date(groupData.firstTimestamp), "dd.MM.yy HH:mm", { locale: ru })} / Точек: {groupData.points.length}
                  </p>
                </div>
                <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 static-icon" />
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-0">
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
                            {record.measurements[i] !== undefined ? record.measurements[i].toFixed(precision).replace('.', ',') : '–'}
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-medium">
                          {record.correctedAverageMeasurement.toFixed(precision).replace('.', ',')}
                          {unit}
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
        ))}
      </Accordion>
    );
  };


  return (
    <PageLayout pageTitle="Журнал записей">
      <div className="space-y-6">
        <div className="flex justify-between items-center gap-4 flex-wrap">
          <h2 className="text-2xl font-semibold flex items-center"><ListOrdered className="mr-2 h-6 w-6 text-primary shrink-0" />Сохраненные записи</h2>
          <div className="flex gap-2 flex-wrap flex-shrink-0">
            <Link href="/" passHref>
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" /> На главную
              </Button>
            </Link>
            <Button onClick={handleDownloadExcel} disabled={allRecords.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Скачать все в Exel
            </Button>
            <AlertDialog open={isDeleteSelectedAlertOpen} onOpenChange={setIsDeleteSelectedAlertOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={selectedRecords.size === 0}>
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
                <Button variant="destructive" disabled={currentDisplayRecords.length === 0}>
                  <Trash2 className="mr-2 h-4 w-4" /> Удалить все для {currentDeviceTypeName}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Подтвердите удаление</AlertDialogTitle>
                  <AlertDialogDescription>
                    Вы уверены, что хотите удалить ВСЕ записи для {currentDeviceTypeAdjective}? Это действие необратимо.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAllRecordsOfType}>Удалить</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
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
