-- ============================================================================
-- AbsenceTrack — 0004 : retirer une personne SANS casser l'historique
-- ----------------------------------------------------------------------------
-- POURQUOI
--   Une fiche (professeur, surveillant) est CITEE par les signalements :
--     signalements.decide_par   = qui a approuve
--     signalements.signale_par  = qui a saisi
--   La supprimer ferait perdre « qui a approuve quoi ». On la marque donc
--   INACTIVE (« sortie de l'etablissement »), exactement comme un eleve qui part :
--   elle sort des compteurs de personnes, mais tout son historique reste lisible.
--
-- CE QUI CHANGE
--   Le directeur peut modifier la colonne « actif » d'une fiche. Jusqu'ici il ne
--   pouvait modifier QUE le nom — c'est un verrou de colonne VOLONTAIRE, pour
--   qu'aucun enseignant ne puisse s'attribuer un autre role. Ce verrou reste :
--   on ajoute « actif » a la liste des colonnes modifiables, rien d'autre.
-- ============================================================================

grant update (nom, actif) on profils to authenticated;

comment on column profils.actif is
  'Fiche active. Mettre a false = personne ayant quitte l''etablissement : elle sort des compteurs mais garde tout l''historique qu''elle a approuve.';
