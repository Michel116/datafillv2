
'use client';

import { Geist, Marck_Script } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { useState, useEffect } from 'react';
import { Flower } from 'lucide-react';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const marckScript = Marck_Script({
  variable: '--font-marck-script',
  weight: '400',
  style: 'normal',
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
});

const APP_TITLE = 'DataFill - Ваш Помощник в Поверке Приборов';
const APP_DESCRIPTION = 'Приложение для автоматического заполнения таблиц';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isInitialAppLoad, setIsInitialAppLoad] = useState(true);

  useEffect(() => {
    document.title = APP_TITLE;
    
    let descriptionMetaTag = document.querySelector('meta[name="description"]');
    if (!descriptionMetaTag) {
      descriptionMetaTag = document.createElement('meta');
      descriptionMetaTag.setAttribute('name', 'description');
      document.head.appendChild(descriptionMetaTag);
    }
    descriptionMetaTag.setAttribute('content', APP_DESCRIPTION);

    const linkIcon = document.querySelector('link[rel="icon"]');
    if (!linkIcon) {
        const newLinkIcon = document.createElement('link');
        newLinkIcon.setAttribute('rel', 'icon');
        newLinkIcon.setAttribute('href', '/favicon.svg'); 
        newLinkIcon.setAttribute('type', 'image/svg+xml');
        document.head.appendChild(newLinkIcon);
    } else {
        linkIcon.setAttribute('href', '/favicon.svg');
        linkIcon.setAttribute('type', 'image/svg+xml');
    }


    const timer = setTimeout(() => {
      setIsInitialAppLoad(false);
    }, 1000); 

    return () => clearTimeout(timer);
  }, []);

  if (isInitialAppLoad) {
    return (
      <html lang="ru" className={`${geistSans.variable} ${marckScript.variable}`}>
        <head>
          {/* Favicon link is managed in useEffect */}
        </head>
        <body className="font-sans antialiased">
          <div className="flex flex-col items-center justify-center min-h-screen bg-background text-center p-4">
            {/* Removed "Вас Приветствует:" text */}
            <Flower className="h-16 w-16 text-primary mb-4 animate-bounce" /> 
            <div className="flex items-center justify-center mb-2">
              <h1 className="text-4xl font-bold text-primary">DataFill</h1>
              <span className="ml-2 text-xs font-medium text-accent-foreground bg-accent px-1.5 py-0.5 rounded-sm">
                beta
              </span>
            </div>
            <p className="text-lg text-muted-foreground">Ваш помощник в поверке приборов</p>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="ru" className={`${geistSans.variable} ${marckScript.variable}`}>
      <head>
         {/* Favicon link is managed in useEffect */}
      </head>
      <body className="font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
