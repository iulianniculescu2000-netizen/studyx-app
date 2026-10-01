import { BookOpen, Download, Layers, Stethoscope } from 'lucide-react';
import type { TourDefinition } from '../types';

export const residencyTour: TourDefinition = {
  id: 'residency',
  title: 'Rezidențiat',
  autoStartRoute: '/rezidentiat',
  steps: [
    {
      id: 'residency-intro',
      title: 'Rezidențiat, într-un singur loc',
      body: 'Grile reale, cărți și carduri, aranjate pe discipline și specialități. Un tur scurt, ca să știi unde e fiecare lucru.',
      icon: <Stethoscope size={22} />,
      placement: 'center',
      route: '/rezidentiat',
      accent: '#0A84FF',
    },
    {
      id: 'residency-disciplines',
      title: 'Alege o disciplină',
      body: 'Intri într-o disciplină, apoi într-o specialitate: vezi testele, progresul și continui de unde ai rămas. „Joacă tot” amestecă toate testele unei specialități într-o sesiune.',
      icon: <Layers size={22} />,
      target: '[data-tutorial="residency-disciplines"]',
      targetPadding: 8,
      placement: 'bottom',
      route: '/rezidentiat',
      // No disciplines to point at until some grile are in the profile.
      when: (ctx) => ctx.quizCount > 0,
    },
    {
      id: 'residency-resources',
      title: 'Resurse',
      body: 'Carduri Kumar, cărțile tale (cu capitole, discuții și grile generate din ele) și un chat care răspunde cu trimitere la capitol. Grilele generate de AI intră singure în Grile › specialitate.',
      icon: <BookOpen size={22} />,
      target: '[data-tutorial="residency-resources"]',
      targetPadding: 8,
      placement: 'top',
      route: '/rezidentiat',
      accent: '#BF6FFF',
    },
    {
      id: 'residency-import',
      title: 'Adaugă banca de grile',
      body: 'Ce mai ai de adăugat apare aici: apeși „Adaugă” o dată și grilele se așază singure pe specialități.',
      icon: <Download size={22} />,
      target: '[data-tutorial="residency-import"]',
      targetPadding: 8,
      placement: 'top',
      route: '/rezidentiat',
      accent: '#30D158',
      // The list of what can still be added only shows while there is something to add, i.e. on an empty profile.
      when: (ctx) => ctx.quizCount === 0,
    },
  ],
};
