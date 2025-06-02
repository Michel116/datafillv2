
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
import { Button } from '@/components/ui/button'; // AlertDialogAction is styled as a button

interface VerifierNameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  currentName?: string;
}

const VERIFIER_NAME_LS_KEY = 'datafill-verifier-name';

const VerifierNameDialog: React.FC<VerifierNameDialogProps> = ({ isOpen, onClose, onSave, currentName }) => {
  const [name, setName] = useState(currentName || '');

  useEffect(() => {
    if (isOpen) {
      setName(currentName || localStorage.getItem(VERIFIER_NAME_LS_KEY) || '');
    }
  }, [isOpen, currentName]);

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim());
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Укажите ФИО поверителя</AlertDialogTitle>
          <AlertDialogDescription>
            Это ФИО будет связано со всеми записями поверки, которые вы создадите в текущей сессии.
            Вы сможете изменить его позже.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label htmlFor="verifierName" className="text-right">
            ФИО поверителя
          </Label>
          <Input
            id="verifierName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, Иванов Иван Иванович"
            className="mt-2"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) {
                handleSave();
              }
            }}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Отмена</AlertDialogCancel>
          <AlertDialogAction onClick={handleSave} disabled={!name.trim()}>
            Сохранить и продолжить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default VerifierNameDialog;
