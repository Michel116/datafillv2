
'use client';

import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface VerifierNameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, allSurnames: string[]) => void;
  currentName?: string;
  savedSurnames?: string[];
}

const VerifierNameDialog: React.FC<VerifierNameDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  currentName,
  savedSurnames = [],
}) => {
  const [inputValue, setInputValue] = useState(currentName || '');
  const [internalSurnamesList, setInternalSurnamesList] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setInputValue(currentName || '');
      setInternalSurnamesList([...savedSurnames].sort());
    }
  }, [isOpen, currentName, savedSurnames]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    // Удаляем все цифры
    value = value.replace(/[0-9]/g, '');
    // Делаем первую букву заглавной, если строка не пустая
    if (value.length > 0) {
      value = value.charAt(0).toUpperCase() + value.slice(1);
    }
    setInputValue(value);
  };

  const handleSave = () => {
    const nameToSave = inputValue.trim();
    // Проверка, что имя не пустое после trim, т.к. оно могло состоять только из цифр
    if (nameToSave) {
      const updatedSavedSurnames = Array.from(new Set([...internalSurnamesList, nameToSave])).sort();
      onSave(nameToSave, updatedSavedSurnames);
    } else {
      // Если input пуст после очистки от цифр и trim, сохраняем пустую строку
      // и текущий список фамилий (возможно, с удалениями)
      onSave('', internalSurnamesList);
      setInputValue(''); // Очищаем inputValue, если он стал пустым
    }
  };

  const handleSurnameSelect = (selectedValue: string) => {
    setInputValue(selectedValue);
  };

  const handleDeleteSurname = (surnameToDelete: string) => {
    const newList = internalSurnamesList.filter(s => s !== surnameToDelete);
    setInternalSurnamesList(newList);
    if (inputValue === surnameToDelete) {
      setInputValue('');
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Укажите фамилию поверителя</AlertDialogTitle>
          <AlertDialogDescription>
            Эта фамилия будет связана со всеми записями поверки. Вы можете ввести новую фамилию или выбрать из ранее сохраненных.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label htmlFor="verifierNameInput" className="text-right">
              Фамилия поверителя
            </Label>
            <Input
              id="verifierNameInput"
              value={inputValue}
              onChange={handleInputChange}
              placeholder="Например, Иванов"
              className="mt-2"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inputValue.trim()) {
                  handleSave();
                }
              }}
            />
          </div>
          {internalSurnamesList && internalSurnamesList.length > 0 && (
            <div>
              <Label htmlFor="savedSurnamesSelect">Или выберите из сохраненных</Label>
              <Select onValueChange={handleSurnameSelect} value={internalSurnamesList.includes(inputValue) ? inputValue : undefined}>
                <SelectTrigger id="savedSurnamesSelect" className="mt-2">
                  <SelectValue placeholder="Выбрать фамилию..." />
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="h-auto max-h-60">
                    {internalSurnamesList.map((surname) => (
                      <SelectItem key={surname} value={surname}>
                        {surname}
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>
          )}
          {internalSurnamesList.length > 0 && (
            <div className="mt-4 space-y-2">
                <Label>Управление сохраненными фамилиями:</Label>
                <ScrollArea className="h-auto max-h-32 border rounded-md p-2">
                    <ul className="space-y-1">
                        {internalSurnamesList.map((surname) => (
                            <li key={surname} className="flex items-center justify-between p-1 hover:bg-muted/50 rounded-sm">
                                <span className="text-sm">{surname}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="p-1 h-auto text-destructive hover:bg-destructive/10"
                                    onClick={() => handleDeleteSurname(surname)}
                                    aria-label={`Удалить ${surname}`}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                </ScrollArea>
            </div>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Отмена</AlertDialogCancel>
          <AlertDialogAction onClick={handleSave} disabled={!inputValue.trim() && internalSurnamesList.length === savedSurnames.length /* Disable if no input and no deletion happened */}>
            Сохранить и продолжить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default VerifierNameDialog;
