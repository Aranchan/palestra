// Elenco di base degli esercizi: [nome, gruppo, attrezzo, misura]
// misura: "rip" = ripetizioni, "sec" = secondi, "min" = minuti
window.GRUPPI = ["Petto", "Dorso", "Spalle", "Bicipiti", "Tricipiti", "Avambracci", "Gambe", "Glutei", "Polpacci", "Addome", "Cardio", "Altro"];

window.ESERCIZI_BASE = [
  ["Panca piana con bilanciere", "Petto", "Bilanciere", "rip"],
  ["Panca piana con manubri", "Petto", "Manubri", "rip"],
  ["Panca inclinata con bilanciere", "Petto", "Bilanciere", "rip"],
  ["Panca inclinata con manubri", "Petto", "Manubri", "rip"],
  ["Panca declinata", "Petto", "Bilanciere", "rip"],
  ["Croci con manubri", "Petto", "Manubri", "rip"],
  ["Croci ai cavi", "Petto", "Cavi", "rip"],
  ["Chest press", "Petto", "Macchina", "rip"],
  ["Pectoral machine", "Petto", "Macchina", "rip"],
  ["Piegamenti sulle braccia", "Petto", "Corpo libero", "rip"],
  ["Dip alle parallele", "Petto", "Corpo libero", "rip"],

  ["Trazioni alla sbarra", "Dorso", "Corpo libero", "rip"],
  ["Trazioni assistite", "Dorso", "Macchina", "rip"],
  ["Lat machine avanti", "Dorso", "Macchina", "rip"],
  ["Lat machine presa stretta", "Dorso", "Macchina", "rip"],
  ["Rematore con bilanciere", "Dorso", "Bilanciere", "rip"],
  ["Rematore con manubrio", "Dorso", "Manubri", "rip"],
  ["Pulley basso", "Dorso", "Cavi", "rip"],
  ["Pulldown a braccia tese", "Dorso", "Cavi", "rip"],
  ["Low row", "Dorso", "Macchina", "rip"],
  ["T-bar row", "Dorso", "Bilanciere", "rip"],
  ["Stacco da terra", "Dorso", "Bilanciere", "rip"],
  ["Hyperextension", "Dorso", "Corpo libero", "rip"],

  ["Military press", "Spalle", "Bilanciere", "rip"],
  ["Lento avanti con manubri", "Spalle", "Manubri", "rip"],
  ["Shoulder press", "Spalle", "Macchina", "rip"],
  ["Arnold press", "Spalle", "Manubri", "rip"],
  ["Alzate laterali", "Spalle", "Manubri", "rip"],
  ["Alzate laterali ai cavi", "Spalle", "Cavi", "rip"],
  ["Alzate frontali", "Spalle", "Manubri", "rip"],
  ["Alzate posteriori", "Spalle", "Manubri", "rip"],
  ["Reverse fly", "Spalle", "Macchina", "rip"],
  ["Face pull", "Spalle", "Cavi", "rip"],
  ["Tirate al mento", "Spalle", "Bilanciere", "rip"],
  ["Scrollate", "Spalle", "Manubri", "rip"],

  ["Curl con bilanciere", "Bicipiti", "Bilanciere", "rip"],
  ["Curl con bilanciere EZ", "Bicipiti", "Bilanciere EZ", "rip"],
  ["Curl con manubri", "Bicipiti", "Manubri", "rip"],
  ["Curl a martello", "Bicipiti", "Manubri", "rip"],
  ["Curl concentrato", "Bicipiti", "Manubri", "rip"],
  ["Curl alla panca Scott", "Bicipiti", "Bilanciere EZ", "rip"],
  ["Curl ai cavi", "Bicipiti", "Cavi", "rip"],

  ["Push down ai cavi", "Tricipiti", "Cavi", "rip"],
  ["Push down con corda", "Tricipiti", "Cavi", "rip"],
  ["French press", "Tricipiti", "Bilanciere EZ", "rip"],
  ["Estensioni sopra la testa", "Tricipiti", "Manubri", "rip"],
  ["Kickback", "Tricipiti", "Manubri", "rip"],
  ["Panca presa stretta", "Tricipiti", "Bilanciere", "rip"],
  ["Dip su panca", "Tricipiti", "Corpo libero", "rip"],

  ["Curl dei polsi", "Avambracci", "Bilanciere", "rip"],
  ["Farmer walk", "Avambracci", "Manubri", "sec"],

  ["Squat con bilanciere", "Gambe", "Bilanciere", "rip"],
  ["Front squat", "Gambe", "Bilanciere", "rip"],
  ["Goblet squat", "Gambe", "Manubri", "rip"],
  ["Hack squat", "Gambe", "Macchina", "rip"],
  ["Leg press", "Gambe", "Macchina", "rip"],
  ["Affondi con manubri", "Gambe", "Manubri", "rip"],
  ["Affondi bulgari", "Gambe", "Manubri", "rip"],
  ["Step-up", "Gambe", "Manubri", "rip"],
  ["Leg extension", "Gambe", "Macchina", "rip"],
  ["Leg curl sdraiato", "Gambe", "Macchina", "rip"],
  ["Leg curl seduto", "Gambe", "Macchina", "rip"],
  ["Stacco rumeno", "Gambe", "Bilanciere", "rip"],
  ["Adductor machine", "Gambe", "Macchina", "rip"],
  ["Abductor machine", "Glutei", "Macchina", "rip"],
  ["Hip thrust", "Glutei", "Bilanciere", "rip"],
  ["Ponte glutei", "Glutei", "Corpo libero", "rip"],
  ["Slanci ai cavi", "Glutei", "Cavi", "rip"],

  ["Calf raise in piedi", "Polpacci", "Macchina", "rip"],
  ["Calf raise seduto", "Polpacci", "Macchina", "rip"],
  ["Calf alla leg press", "Polpacci", "Macchina", "rip"],

  ["Crunch", "Addome", "Corpo libero", "rip"],
  ["Crunch inverso", "Addome", "Corpo libero", "rip"],
  ["Crunch ai cavi", "Addome", "Cavi", "rip"],
  ["Plank", "Addome", "Corpo libero", "sec"],
  ["Plank laterale", "Addome", "Corpo libero", "sec"],
  ["Russian twist", "Addome", "Corpo libero", "rip"],
  ["Sollevamento gambe alla sbarra", "Addome", "Corpo libero", "rip"],
  ["Ab wheel", "Addome", "Altro", "rip"],
  ["Mountain climber", "Addome", "Corpo libero", "sec"],

  ["Tapis roulant", "Cardio", "Macchina", "min"],
  ["Cyclette", "Cardio", "Macchina", "min"],
  ["Ellittica", "Cardio", "Macchina", "min"],
  ["Vogatore", "Cardio", "Macchina", "min"],
  ["Stair climber", "Cardio", "Macchina", "min"],
  ["Salto della corda", "Cardio", "Altro", "min"],
  ["Burpees", "Cardio", "Corpo libero", "rip"],
  ["Kettlebell swing", "Glutei", "Kettlebell", "rip"]
];

// Traduzioni per il database esteso (free-exercise-db, pubblico dominio)
window.FX_MUSCOLI = {
  chest: "Petto", lats: "Dorso", "middle back": "Dorso", "lower back": "Dorso", traps: "Spalle",
  shoulders: "Spalle", biceps: "Bicipiti", triceps: "Tricipiti", forearms: "Avambracci",
  quadriceps: "Gambe", hamstrings: "Gambe", adductors: "Gambe", abductors: "Glutei",
  glutes: "Glutei", calves: "Polpacci", abdominals: "Addome", neck: "Altro"
};
window.FX_ATTREZZI = {
  barbell: "Bilanciere", dumbbell: "Manubri", machine: "Macchina", cable: "Cavi",
  "body only": "Corpo libero", kettlebells: "Kettlebell", bands: "Elastici",
  "e-z curl bar": "Bilanciere EZ", "medicine ball": "Palla medica", "exercise ball": "Fitball",
  "foam roll": "Foam roller", other: "Altro"
};
