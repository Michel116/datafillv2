
'use client';

import Link from 'next/link';
import { Thermometer, Smartphone, ListOrdered, UserCircle } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card'; // Removed CardHeader, CardContent as they are not directly used in renderOptionCard
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import VerifierNameDialog from '@/components/dialogs/VerifierNameDialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AppOption {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  href: string;
  requiresVerifierName?: boolean;
}

const VERIFIER_NAME_LS_KEY = 'datafill-verifier-name';
const SAVED_VERIFIER_SURNAMES_LS_KEY = 'datafill-saved-surnames';

const deviceOptions: AppOption[] = [
  {
    id: 'thermometer',
    name: 'Термометры',
    icon: Thermometer,
    description: 'Ввод данных для термометров.',
    href: '/fill-data?device=thermometer&deviceName=Термометры',
    requiresVerifierName: true,
  },
  {
    id: 'alcotest',
    name: 'Алкотестер Е-200',
    icon: Smartphone,
    description: 'Ввод данных для алкотестеров.',
    href: '/fill-data?device=alcotest&deviceName=Алкотестер%20Е-200',
    requiresVerifierName: true,
  },
];

const utilityOptions: AppOption[] = [
  {
    id: 'records',
    name: 'Журнал записей',
    icon: ListOrdered,
    description: 'Просмотр и скачивание сохраненных данных.',
    href: '/records',
  },
];

export default function HomePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isVerifierDialogVisible, setIsVerifierDialogVisible] = useState(false);
  const [verifierName, setVerifierName] = useState('');
  const [savedVerifierSurnames, setSavedVerifierSurnames] = useState<string[]>([]);
  const [targetHref, setTargetHref] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedName = localStorage.getItem(VERIFIER_NAME_LS_KEY);
      if (storedName) {
        setVerifierName(storedName);
      }

      const storedSurnames = localStorage.getItem(SAVED_VERIFIER_SURNAMES_LS_KEY);
      let initialSavedSurnames: string[] = [];
      if (storedSurnames) {
        try {
          const parsedSurnames = JSON.parse(storedSurnames);
          if (Array.isArray(parsedSurnames)) {
            initialSavedSurnames = parsedSurnames.filter(s => typeof s === 'string');
          }
        } catch (e) {
          console.error("Failed to parse saved surnames from localStorage", e);
          initialSavedSurnames = [];
        }
      }
      
      if (storedName && !initialSavedSurnames.includes(storedName)) {
         const updatedSurnames = Array.from(new Set([...initialSavedSurnames, storedName])).sort();
         localStorage.setItem(SAVED_VERIFIER_SURNAMES_LS_KEY, JSON.stringify(updatedSurnames));
         setSavedVerifierSurnames(updatedSurnames);
      } else {
        setSavedVerifierSurnames(initialSavedSurnames.sort());
      }
    }
  }, []);

  const handleOptionClick = (option: AppOption, e: React.MouseEvent<HTMLAnchorElement>) => {
    if (option.requiresVerifierName && !verifierName) {
      e.preventDefault(); 
      setTargetHref(option.href); 
      setIsVerifierDialogVisible(true);
    } else if (option.href) {
      if (!e.defaultPrevented) {
        router.push(option.href);
      }
    }
  };

  const handleSaveVerifier = (name: string, allSurnamesFromDialog: string[]) => {
    const finalSurnames = Array.from(new Set(allSurnamesFromDialog)).sort();
    
    if (name.trim()) {
      localStorage.setItem(VERIFIER_NAME_LS_KEY, name);
      setVerifierName(name);
      toast({ title: "Фамилия поверителя сохранена", description: `Поверитель: ${name}` });

      if (!finalSurnames.includes(name)) {
        finalSurnames.push(name);
        finalSurnames.sort();
      }
    } else {
      localStorage.removeItem(VERIFIER_NAME_LS_KEY);
      setVerifierName('');
      toast({ title: "Фамилия поверителя очищена", variant: "default" });
    }
    
    localStorage.setItem(SAVED_VERIFIER_SURNAMES_LS_KEY, JSON.stringify(finalSurnames));
    setSavedVerifierSurnames(finalSurnames);

    setIsVerifierDialogVisible(false);
    if (name.trim() && targetHref) {
      router.push(targetHref);
      setTargetHref(null);
    } else if (!name.trim() && targetHref) {
      toast({ title: "Требуется фамилия", description: "Для продолжения укажите фамилию поверителя.", variant: "destructive"});
      setIsVerifierDialogVisible(true); 
    }
  };
  
  const handleChangeVerifier = () => {
    setTargetHref(null); 
    setIsVerifierDialogVisible(true);
  };

  const baseDelay = 0;
  const cardStartDelay = 200;

  const renderOptionCard = (option: AppOption, index: number) => (
    <Link
      key={option.id}
      href={option.href}
      onClick={(e) => handleOptionClick(option, e)}
      className="group block transform transition-shadow duration-200 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-xl animate-fade-in-up w-full"
      style={{ animationDelay: `${(cardStartDelay + index * 100)}ms`, opacity: 0 }}
    >
      <Card className="flex flex-col items-center text-center bg-card shadow-md p-6 rounded-xl h-full cursor-pointer">
        <div className="p-3 bg-primary/10 rounded-full inline-block mb-4">
          <option.icon className="h-7 w-7 text-primary" strokeWidth={1.5} />
        </div>
        <CardTitle className="text-lg font-semibold text-foreground mb-1">{option.name}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">{option.description}</CardDescription>
      </Card>
    </Link>
  );


  return (
    <PageLayout>
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl animate-fade-in-up" style={{ animationDelay: `${baseDelay}ms`, opacity: 0 }}>
            Выберите действие
          </h2>
          <p className="mt-3 text-lg text-muted-foreground animate-fade-in-up" style={{ animationDelay: `${baseDelay + 100}ms`, opacity: 0 }}>
            Устройство, которое будет поверяться или просмотрите журнал.
          </p>
          {verifierName && (
            <div className="mt-4 text-sm text-muted-foreground animate-fade-in-up" style={{ animationDelay: `${baseDelay + 150}ms`, opacity: 0 }}>
              <span>Поверитель: <span className="font-semibold text-foreground">{verifierName}</span></span>
              <Button variant="link" size="sm" onClick={handleChangeVerifier} className="ml-1 px-1 py-0 h-auto text-primary">
                (изменить/управлять)
              </Button>
            </div>
          )}
           {!verifierName && ( 
             <div className="mt-4 animate-fade-in-up" style={{ animationDelay: `${baseDelay + 150}ms`, opacity: 0 }}>
              <Button onClick={() => { setTargetHref(null); setIsVerifierDialogVisible(true); }} variant="outline" size="sm">
                <UserCircle className="mr-2 h-4 w-4" /> Указать фамилию поверителя
              </Button>
            </div>
           )}
        </div>
        
        <h3 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl text-center animate-fade-in-up" style={{ animationDelay: `${baseDelay + 200}ms`, opacity: 0 }}>Заполнение данных</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {deviceOptions.map((option, idx) => renderOptionCard(option, idx))}
        </div>

        <h3 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl text-center pt-4 animate-fade-in-up" style={{ animationDelay: `${cardStartDelay + deviceOptions.length * 100}ms`, opacity: 0 }}>Утилиты</h3>
        <div className="grid grid-cols-1 gap-6 max-w-xs sm:max-w-sm mx-auto">
           {utilityOptions.map((option, idx) => renderOptionCard(option, deviceOptions.length + idx))}
        </div>
      </div>
      <VerifierNameDialog
        isOpen={isVerifierDialogVisible}
        onClose={() => { setIsVerifierDialogVisible(false); setTargetHref(null); }}
        onSave={handleSaveVerifier}
        currentName={verifierName}
        savedSurnames={savedVerifierSurnames}
      />
    </PageLayout>
  );
}
    

