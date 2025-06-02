
'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PageLayout from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { Wrench, QrCode, ListChecks, Hash, ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, UserCircle, Thermometer, Smartphone } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


type Stage = 'SCAN_QR' | 'SELECT_ROW' | 'ENTER_MEASUREMENT' | 'COMPLETED_SET' | 'VERIFIER_REQUIRED';

interface RowOption {
  value: string;
  label: string;
  correction: number;
  lowerLimit: number;
  upperLimit: number;
}

interface MeasurementRecord {
  id: string;
  timestamp: string;
  serialNumber: string;
  deviceName: string;
  deviceType: string;
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

const VERIFIER_NAME_LS_KEY = 'datafill-verifier-name';

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


const MEASUREMENTS_COUNT = 3;

function FillDataContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [deviceType, setDeviceType] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [verifierName, setVerifierName] = useState<string>('');

  const [stage, setStage] = useState<Stage>('VERIFIER_REQUIRED');
  const [serialNumber, setSerialNumber] = useState('');
  const [selectedRow, setSelectedRow] = useState<RowOption | null>(null);
  const [currentMeasurementIndex, setCurrentMeasurementIndex] = useState(0);
  const [measurements, setMeasurements] = useState<number[]>([]);
  const [currentNumberInput, setCurrentNumberInput] = useState('');
  const [resultStatus, setResultStatus] = useState<'ГОДЕН' | 'БРАК' | null>(null);

  const serialNumberInputRef = useRef<HTMLInputElement>(null);
  const measurementInputRef = useRef<HTMLInputElement>(null);

  const [currentDeviceRowOptions, setCurrentDeviceRowOptions] = useState<RowOption[]>([]);
  const [unit, setUnit] = useState<string>('');
  const [inputPlaceholder, setInputPlaceholder] = useState<string>('');
  const [serialNumberPlaceholder, setSerialNumberPlaceholder] = useState<string>('');
  const [measurementPrecision, setMeasurementPrecision] = useState<number>(2);

  const [isOverwriteAlertOpen, setIsOverwriteAlertOpen] = useState(false);
  const [dataForOverwrite, setDataForOverwrite] = useState<MeasurementRecord | null>(null);


  useEffect(() => {
    const deviceParam = searchParams.get('device');
    const nameParam = searchParams.get('deviceName');

    if (!deviceParam || !nameParam) {
      toast({
        title: "Ошибка",
        description: "Тип устройства не указан. Пожалуйста, выберите устройство.",
        variant: "destructive",
      });
      router.push('/');
      return;
    }

    setDeviceType(deviceParam);
    setDeviceName(nameParam);

    if (deviceParam === 'thermometer') {
      setCurrentDeviceRowOptions(ROW_OPTIONS_THERMOMETER);
      setUnit('°C');
      setInputPlaceholder("Напр. 36.6");
      setSerialNumberPlaceholder("Напр. М1024700123");
      setMeasurementPrecision(2);
    } else if (deviceParam === 'alcotest') {
      setCurrentDeviceRowOptions(ROW_OPTIONS_ALCOTEST);
      setUnit('мг/л');
      setInputPlaceholder("Напр. 0.150");
      setSerialNumberPlaceholder("Напр. IRO4J1234");
      setMeasurementPrecision(3);
    }


    if (typeof window !== 'undefined') {
      const storedVerifierName = localStorage.getItem(VERIFIER_NAME_LS_KEY);
      if (storedVerifierName) {
        setVerifierName(storedVerifierName);
        setStage('SCAN_QR');
      } else {
        setStage('VERIFIER_REQUIRED');
      }
    }

    setSerialNumber('');
    setSelectedRow(null);
    setCurrentMeasurementIndex(0);
    setMeasurements([]);
    setCurrentNumberInput('');
    setResultStatus(null);
  }, [searchParams, router, toast]);


  useEffect(() => {
    if (stage === 'SCAN_QR' && verifierName && serialNumberInputRef.current) {
      serialNumberInputRef.current.focus();
    } else if (stage === 'ENTER_MEASUREMENT' && measurementInputRef.current) {
      measurementInputRef.current.focus();
    }
  }, [stage, verifierName]);


  if (stage === 'VERIFIER_REQUIRED' && !verifierName) {
      return (
          <PageLayout pageTitle="Требуется указать поверителя">
              <Card className="w-full">
              <CardHeader>
                  <CardTitle className="flex items-center gap-2"><UserCircle className="h-6 w-6 text-destructive" />Не указана фамилия поверителя</CardTitle>
                  <CardDescription>
                  Пожалуйста, вернитесь на главную страницу и укажите вашу фамилию для продолжения работы.
                  Это необходимо для корректного сохранения записей.
                  </CardDescription>
              </CardHeader>
              <CardContent>
                  <Button onClick={() => router.push('/')} className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Вернуться на главную
                  </Button>
              </CardContent>
              </Card>
          </PageLayout>
      );
  }

  const handleQrScanSubmit = () => {
    if (!serialNumber.trim()) {
      toast({ title: "Ошибка", description: "Серийный номер не может быть пустым.", variant: "destructive" });
      return;
    }
    setStage('SELECT_ROW');
    toast({ title: "Серийный номер принят", description: `SN: ${serialNumber}`,variant: "default" });
  };

  const handleRowSelect = (row: RowOption) => {
    setSelectedRow(row);
    setCurrentMeasurementIndex(0);
    setMeasurements([]);
    setCurrentNumberInput('');
    setResultStatus(null);
    setStage('ENTER_MEASUREMENT');
    toast({ title: "Точка поверки выбрана", description: `Точка: ${row.label}`, variant: "default" });
  };

const handleMeasurementInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const currentInputValue = e.target.value;
  const previousNumberInput = currentNumberInput; 

  let newFormattedValue = "";
  const localPrecision = deviceType === 'alcotest' ? 3 : 2;

  if (deviceType === 'alcotest') {
    const sanitizedInput = currentInputValue.replace(',', '.');
    
    if (previousNumberInput === "" && /^\d$/.test(sanitizedInput) && sanitizedInput.length === 1) {
      newFormattedValue = sanitizedInput + ".";
    } 
    else if (previousNumberInput.length === 1 && /^\d$/.test(previousNumberInput) && 
               /^\d\d$/.test(sanitizedInput) && sanitizedInput.startsWith(previousNumberInput) && sanitizedInput.length === 2) {
      newFormattedValue = previousNumberInput[0] + "." + sanitizedInput.substring(1, 2);
    }
    else {
      let integerPart = "";
      let fractionalPart = "";
      let hasDot = false;

      for (const char of sanitizedInput) {
        if (/\d/.test(char)) {
          if (!hasDot) {
            if (integerPart.length < 1) { // Max 1 digit before dot
              integerPart += char;
            }
          } else {
            if (fractionalPart.length < localPrecision) { 
              fractionalPart += char;
            }
          }
        } else if (char === '.' && !hasDot && integerPart.length > 0) {
          hasDot = true;
        }
      }

      if (integerPart) { 
        newFormattedValue = integerPart;
        if (hasDot || fractionalPart.length > 0) { 
            newFormattedValue += "." + fractionalPart;
        } else if (integerPart.length === 1 && previousNumberInput.length === 0 && currentInputValue.length === 1 && currentInputValue === integerPart) {
            // This condition handles the auto-dot after first digit if user deletes and re-enters
             newFormattedValue += ".";
        }
      } else {
          newFormattedValue = ""; 
      }
    }
  } else { // For thermometer
    const sanitizedInput = currentInputValue.replace(',', '.');
    let integerPart = "";
    let fractionalPart = "";
    let hasDotInitially = false;
    let dotPosition = -1;

    for (let i = 0; i < sanitizedInput.length; i++) {
      if (sanitizedInput[i] === '.') {
        hasDotInitially = true;
        dotPosition = i;
        break;
      }
    }

    if (hasDotInitially) {
      integerPart = sanitizedInput.substring(0, dotPosition).replace(/[^\d]/g, '');
      fractionalPart = sanitizedInput.substring(dotPosition + 1).replace(/[^\d]/g, '');
    } else {
      integerPart = sanitizedInput.replace(/[^\d]/g, '');
    }

    let dotWasAutoInserted = false;
    // Check if we should auto-insert dot: 
    // 1. No dot present initially
    // 2. Integer part becomes 3 or more digits (e.g., "36" -> "366")
    // 3. Input length increased (user typed something, not deleted)
    // 4. Input doesn't end with a dot (user isn't trying to type one)
    if (!hasDotInitially && integerPart.length >= 3 && 
        sanitizedInput.length > previousNumberInput.length && 
        !sanitizedInput.endsWith('.')) {
      fractionalPart = integerPart.substring(2) + fractionalPart; // take digits after 2nd as fractional
      integerPart = integerPart.substring(0, 2); // keep first two as integer
      dotWasAutoInserted = true;
    }
    
    if ((hasDotInitially || dotWasAutoInserted) && integerPart === "") {
        integerPart = "0"; // Handle cases like ".5" or auto-inserted dot with no preceding int part
    }

    if (fractionalPart.length > localPrecision) {
      fractionalPart = fractionalPart.substring(0, localPrecision);
    }

    if (integerPart || fractionalPart.length > 0 || hasDotInitially || dotWasAutoInserted ) {
        newFormattedValue = integerPart;
        if (hasDotInitially || dotWasAutoInserted || fractionalPart.length > 0) { // Add dot if it was there or inserted, or if fractional part exists
            newFormattedValue += "." + fractionalPart;
        }
    } else {
        newFormattedValue = ""; // Reset if nothing valid
    }
     // if just a dot was entered, make it "0."
     if (newFormattedValue === "." && (hasDotInitially || dotWasAutoInserted)) newFormattedValue = "0.";


  }
  
  setCurrentNumberInput(newFormattedValue);
};

const saveAndProceed = (record: MeasurementRecord, isOverwriting: boolean) => {
    if (typeof window !== 'undefined') {
        try {
            let existingRecordsRaw = localStorage.getItem('measurementRecords');
            let existingRecords: MeasurementRecord[] = existingRecordsRaw ? JSON.parse(existingRecordsRaw) : [];

            if (isOverwriting) {
                existingRecords = existingRecords.filter(
                    r => !(r.serialNumber === record.serialNumber && r.selectedPointValue === record.selectedPointValue)
                );
            }
            existingRecords.push(record);
            localStorage.setItem('measurementRecords', JSON.stringify(existingRecords));

            toast({
                title: isOverwriting ? `Запись перезаписана` : `Запись сохранена локально`,
                description: `Данные для SN ${record.serialNumber} по точке ${record.selectedPointLabel} ${isOverwriting ? 'успешно перезаписаны' : 'сохранены'}. Поверитель: ${record.verifierName}`,
                variant: "default",
                duration: 3000,
            });
        } catch (error) {
            toast({
                title: "Ошибка сохранения",
                description: "Не удалось сохранить запись локально.",
                variant: "destructive",
            });
            return; // Prevent further state changes if save fails
        }
    }

    setMeasurements([]); // Clear measurements for next entry
    setCurrentNumberInput(''); // Clear input
    setResultStatus(record.result); // Set result status for UI feedback

    toast({
        title: `Результат: ${record.result}`,
        description: `SN ${record.serialNumber}, ${record.selectedPointLabel}. Ср.изм: ${record.averageMeasurement.toFixed(measurementPrecision)}, Скорр.ср: ${record.correctedAverageMeasurement.toFixed(measurementPrecision)}${unit}. Пределы: ${record.lowerLimit.toFixed(measurementPrecision)}-${record.upperLimit.toFixed(measurementPrecision)}${unit}.`,
        variant: record.result === "ГОДЕН" ? "default" : "destructive",
        className: record.result === "ГОДЕН" ? "bg-accent text-accent-foreground border-accent" : "",
        duration: 5000,
    });

    setStage('COMPLETED_SET');
    setTimeout(() => {
        setSerialNumber('');
        setSelectedRow(null);
        setCurrentMeasurementIndex(0);
        setResultStatus(null);
        if (verifierName) {
            setStage('SCAN_QR');
        } else {
            setStage('VERIFIER_REQUIRED');
        }
    }, 3000);
};


  const handleMeasurementSubmit = () => {
    const num = parseFloat(currentNumberInput.replace(',', '.'));
    if (isNaN(num)) {
      toast({ title: "Ошибка", description: "Пожалуйста, введите действительное число.", variant: "destructive" });
      return;
    }
    const newMeasurements = [...measurements, num];
    

    if (newMeasurements.length < MEASUREMENTS_COUNT) {
      setMeasurements(newMeasurements);
      setCurrentNumberInput('');
      setCurrentMeasurementIndex(newMeasurements.length);
      toast({ title: "Измерение добавлено", description: `Измерение ${newMeasurements.length}/${MEASUREMENTS_COUNT} принято.`, variant: "default" });
      if (measurementInputRef.current) {
        measurementInputRef.current.focus();
      }
    } else {
      // All measurements collected, prepare the record
      if (selectedRow && deviceName && deviceType && verifierName) {
        const averageMeasurement = newMeasurements.reduce((a, b) => a + b, 0) / newMeasurements.length;
        const correctedAverage = averageMeasurement + selectedRow.correction;
        const currentResStatus = (correctedAverage >= selectedRow.lowerLimit && correctedAverage <= selectedRow.upperLimit) ? "ГОДЕН" : "БРАК";
        
        const pendingRecordToSave: MeasurementRecord = {
          id: `${Date.now()}-${serialNumber}-${selectedRow.value}`,
          timestamp: new Date().toISOString(),
          serialNumber,
          deviceName,
          deviceType,
          verifierName,
          selectedPointLabel: selectedRow.label,
          selectedPointValue: selectedRow.value,
          correction: selectedRow.correction,
          measurements: newMeasurements.map(m => parseFloat(m.toFixed(measurementPrecision))),
          averageMeasurement: parseFloat(averageMeasurement.toFixed(measurementPrecision)),
          correctedAverageMeasurement: parseFloat(correctedAverage.toFixed(measurementPrecision)),
          lowerLimit: selectedRow.lowerLimit,
          upperLimit: selectedRow.upperLimit,
          result: currentResStatus,
        };

        if (typeof window !== 'undefined') {
            const existingRecordsRaw = localStorage.getItem('measurementRecords');
            const existingRecords: MeasurementRecord[] = existingRecordsRaw ? JSON.parse(existingRecordsRaw) : [];
            
            const duplicateExists = existingRecords.some(
              record => record.serialNumber === serialNumber && record.selectedPointValue === selectedRow.value
            );

            if (duplicateExists) {
              setDataForOverwrite(pendingRecordToSave);
              setIsOverwriteAlertOpen(true);
              return; 
            } else {
              saveAndProceed(pendingRecordToSave, false);
            }
        }
      } else if (!verifierName) {
         toast({
            title: "Ошибка",
            description: "Фамилия поверителя не указана. Запись не может быть сохранена. Вернитесь на главную.",
            variant: "destructive",
            duration: 5000,
          });
         setStage('COMPLETED_SET'); // Still go to completed set to allow reset
            setTimeout(() => {
                setSerialNumber('');
                setSelectedRow(null);
                setCurrentMeasurementIndex(0);
                setMeasurements([]);
                setCurrentNumberInput('');
                setResultStatus(null);
                setStage('VERIFIER_REQUIRED');
            }, 3000);
      }
    }
  };

  const handleOverwriteConfirm = () => {
    if (dataForOverwrite) {
      saveAndProceed(dataForOverwrite, true);
    }
    setIsOverwriteAlertOpen(false);
    setDataForOverwrite(null);
  };

  const handleOverwriteCancel = () => {
    setIsOverwriteAlertOpen(false);
    setDataForOverwrite(null);
    // User stays on ENTER_MEASUREMENT stage, measurements are still there.
    // They can choose to go back or try submitting again (which will re-trigger check)
    toast({ title: "Перезапись отменена", description: "Данные не были изменены.", variant: "default" });
  };

  const goBack = () => {
    if (stage === 'ENTER_MEASUREMENT') {
      setStage('SELECT_ROW');
      setResultStatus(null);
      // Clear measurements when going back from entering measurements to row selection
      setMeasurements([]);
      setCurrentNumberInput('');
      setCurrentMeasurementIndex(0);
    } else if (stage === 'SELECT_ROW') {
      setStage('SCAN_QR');
    } else if (stage === 'SCAN_QR' || stage === 'COMPLETED_SET' || stage === 'VERIFIER_REQUIRED') {
      router.push('/');
    }
  };

  const progressValue = stage === 'ENTER_MEASUREMENT' ? ((currentMeasurementIndex +1) / MEASUREMENTS_COUNT) * 100 : 0;

  if (stage === 'VERIFIER_REQUIRED' && !verifierName) {
    return (
      <PageLayout pageTitle="Требуется указать поверителя">
         <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserCircle className="h-6 w-6 text-destructive" />Не указана фамилия поверителя</CardTitle>
            <CardDescription>
              Пожалуйста, вернитесь на главную страницу и укажите вашу фамилию для продолжения работы.
              Это необходимо для корректного сохранения записей.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/')} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" /> Вернуться на главную
            </Button>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }


  if (!deviceType || !deviceName || currentDeviceRowOptions.length === 0) {
    return (
      <PageLayout pageTitle="Загрузка...">
        <div className="text-center py-10">
          <p className="text-muted-foreground">Загрузка данных об устройстве...</p>
        </div>
      </PageLayout>
    );
  }

  const pageFlowTitle = `${verifierName ? verifierName + ' / ' : ''}${deviceName || 'Устройство'}`;
  const DeviceIcon = deviceType === 'thermometer' ? Thermometer : Smartphone;


  return (
    <PageLayout pageTitle={pageFlowTitle}>
      <Card className="w-full">
        <CardHeader>
          {stage === 'SCAN_QR' && <CardTitle className="flex items-center gap-2"><QrCode className="h-6 w-6 text-primary" />Сканирование QR / Ввод SN</CardTitle>}
          {stage === 'SELECT_ROW' && <CardTitle className="flex items-center gap-2"><ListChecks className="h-6 w-6 text-primary" />Выбор точки поверки</CardTitle>}
          {stage === 'ENTER_MEASUREMENT' && <CardTitle className="flex items-center gap-2"><Hash className="h-6 w-6 text-primary" />Ввод измерений для {selectedRow?.label} ({currentMeasurementIndex + 1}/{MEASUREMENTS_COUNT})</CardTitle>}
          {stage === 'COMPLETED_SET' && <CardTitle className="flex items-center gap-2">
            {resultStatus === "ГОДЕН" ? <CheckCircle2 className="h-6 w-6 text-accent" /> : <AlertTriangle className="h-6 w-6 text-destructive" /> }
            Комплект данных обработан
            </CardTitle>}
          <CardDescription className="flex items-center gap-1.5">
            <DeviceIcon className="h-4 w-4 text-muted-foreground" />
            {stage === 'SCAN_QR' && `Введите серийный номер для устройства "${deviceName}". Поверитель: ${verifierName || 'Не указан'}`}
            {stage === 'SELECT_ROW' && `Для SN: ${serialNumber}. Выберите точку поверки для заполнения. Поверитель: ${verifierName || 'Не указан'}`}
            {stage === 'ENTER_MEASUREMENT' && `Для SN: ${serialNumber}, Точка: ${selectedRow?.label}. Введите измерение. Поверитель: ${verifierName || 'Не указан'}`}
            {stage === 'COMPLETED_SET' && `Данные для SN ${serialNumber} по точке ${selectedRow?.label} обработаны. Результат: ${resultStatus}. Подготовьте следующее устройство или точку.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {stage === 'SCAN_QR' && (
            <div className="space-y-4">
              <Alert className="bg-yellow-100 border-yellow-400 text-yellow-700 [&>svg]:text-yellow-700">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Внимание!</AlertTitle>
                <AlertDescription>
                  При сканировании QR-кода убедитесь, что активна английская раскладка клавиатуры.
                  Некоторые QR-сканеры могут некорректно передавать символы в другой раскладке.
                </AlertDescription>
              </Alert>
              <Label htmlFor="serialNumber">Серийный номер</Label>
              <Input
                id="serialNumber"
                ref={serialNumberInputRef}
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder={serialNumberPlaceholder}
                aria-label="Серийный номер"
                onKeyDown={(e) => e.key === 'Enter' && handleQrScanSubmit()}
              />
              <Button onClick={handleQrScanSubmit} className="w-full" disabled={!serialNumber.trim()}>
                <ArrowRight className="mr-2 h-4 w-4" /> Далее
              </Button>
            </div>
          )}

          {stage === 'SELECT_ROW' && (
            <div className="space-y-4">
              <p className="font-medium text-foreground">Доступные точки поверки:</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {currentDeviceRowOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant="outline"
                    onClick={() => handleRowSelect(option)}
                    className="w-full text-lg py-6 h-auto"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {stage === 'ENTER_MEASUREMENT' && selectedRow && (
            <div className="space-y-4">
              <Label htmlFor="measurementValue">Значение измерения ({currentMeasurementIndex + 1}/{MEASUREMENTS_COUNT})</Label>
              <Progress value={progressValue} className="w-full h-2" />
              <p className="text-sm text-muted-foreground">
                Поправка: {selectedRow.correction.toFixed(measurementPrecision)} {unit}, Пределы: {selectedRow.lowerLimit.toFixed(measurementPrecision)} {unit} ... {selectedRow.upperLimit.toFixed(measurementPrecision)} {unit}
              </p>
              <Input
                id="measurementValue"
                ref={measurementInputRef}
                type="text" 
                inputMode="decimal"
                value={currentNumberInput}
                onChange={handleMeasurementInputChange}
                placeholder={inputPlaceholder}
                aria-label="Значение измерения"
                onKeyDown={(e) => e.key === 'Enter' && handleMeasurementSubmit()}
              />
              <Button onClick={handleMeasurementSubmit} className="w-full" disabled={!currentNumberInput.trim()}>
                <ArrowRight className="mr-2 h-4 w-4" /> Добавить измерение ({measurements.length + 1}/{MEASUREMENTS_COUNT})
              </Button>
            </div>
          )}

          {stage === 'COMPLETED_SET' && (
             <div className="text-center py-4">
                {resultStatus === "ГОДЕН" ?
                  <CheckCircle2 className="h-16 w-16 text-accent mx-auto mb-4" /> :
                  <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
                }
                <p className="text-lg font-semibold">
                  {resultStatus === "ГОДЕН" ? "Отлично! Данные сохранены." : "Внимание! Обнаружен брак."}
                </p>
                <p className="text-muted-foreground">
                  Результат: {resultStatus}. Можно сканировать следующий QR-код или выбрать другую точку.
                </p>
            </div>
          )}

          <Button variant="outline" onClick={goBack} className="w-full mt-4" disabled={stage === 'COMPLETED_SET'}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {stage === 'SCAN_QR' ? 'К выбору устройства' : 'Назад'}
          </Button>
        </CardContent>
      </Card>
      <AlertDialog open={isOverwriteAlertOpen} onOpenChange={setIsOverwriteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Предупреждение</AlertDialogTitle>
            <AlertDialogDescription>
              Данные с серийным номером "{serialNumber}" и для точки "{selectedRow?.label}" уже занесены. 
              Вы хотите перезаписать их?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleOverwriteCancel}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleOverwriteConfirm}>Перезаписать</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}


export default function FillDataPage() {
  return (
    <Suspense fallback={<PageLayout pageTitle="Загрузка..."><div className="text-center py-10"><p className="text-muted-foreground">Загрузка...</p></div></PageLayout>}>
      <FillDataContent />
    </Suspense>
  );
}
    

    

