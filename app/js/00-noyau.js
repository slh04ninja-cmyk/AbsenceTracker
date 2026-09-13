// fichier: app/js/00-noyau.js

// ========== BASE DE DONNÉES ==========
const prenomsDemo = ['Ahmed', 'Fatima', 'Mohamed', 'Khadija', 'Youssef', 'Salma', 'Omar', 'Aya', 'Mehdi', 'Imane', 'Karim', 'Noura', 'Hamza', 'Yassine', 'Sara', 'Anas', 'Malak', 'Reda', 'Ghita', 'Adam', 'Lina', 'Walid', 'Douae', 'Zakaria', 'Hiba', 'Bilal', 'Meriem', 'Soufiane', 'Nisrine', 'Amine', 'Ouiam', 'Taha', 'Rania', 'Ayoub', 'Kawtar', 'Ismail', 'Rim', 'Adil', 'Amal', 'Jawad'];
const nomsDemo = ['El Amrani', 'Benali', 'Alami', 'El Fassi', 'Chraibi', 'Berrada', 'El Idrissi', 'Bennani', 'Tazi', 'El Khatib', 'Ouazzani', 'Benjelloun', 'Sekkat', 'El Mansouri', 'Bouazza', 'El Ghazi', 'Tahiri', 'Naciri', 'El Harrak', 'Kabbaj', 'Zouiten', 'Bennis', 'Lamrani', 'Sefrioui', 'Benkirane', 'Fikri', 'Belkadi', 'El Moudden', 'Zniber', 'Baraka', 'El Hassani', 'Drissi', 'El Fadili', 'Ghannam', 'Haddadi', 'Jaidi', 'Kadiri', 'Laabi', 'Moutawakil', 'Nabil'];
const nomsClassesDemo = ['TCSF-1', 'TCSF-2', 'TCSF-3'];
const NB_ELEVES_DEMO = 12;
const classesDemo = [];
let idEleveDemo = 1;
nomsClassesDemo.forEach((nomClasse, idx) => {
  const eleves = [];
  for (let i = 0; i < NB_ELEVES_DEMO; i++) {
    eleves.push({
      id: idEleveDemo++,
      nom: nomsDemo[(idx * 13 + i * 5) % nomsDemo.length],
      prenom: prenomsDemo[(idx * 7 + i) % prenomsDemo.length]
    });
  }
  classesDemo.push({ id: idx + 1, nom: nomClasse, eleves: eleves });
});

