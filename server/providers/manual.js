// Fournisseur d'objectif "de secours" : pas de source de données externe,
// la valeur est saisie à la main. Utile pour tout objectif qui n'a pas
// encore (ou n'aura jamais) d'intégration automatique dédiée.
export default {
  id: 'manual',
  label: 'Suivi manuel',
  icon: '✏️',
  unit: '',
  description: "Pas de source connectée pour l'instant — tu mets la valeur à jour toi-même.",
  manualEntry: true,
  fields: [],
  // Pas de fetchValue : la mise à jour passe par PATCH /objective/value.
}
