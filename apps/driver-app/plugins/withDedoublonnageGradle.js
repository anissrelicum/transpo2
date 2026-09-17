// Greffon de configuration Expo : fait résoudre le greffon Gradle de React Native au MÊME
// chemin à ses deux points d'inclusion.
//
// `expo prebuild` écrit deux `includeBuild` pour `@react-native/gradle-plugin` :
//   · dans `pluginManagement`  → résolu depuis le dossier du projet Android ;
//   · en fin de fichier        → résolu depuis l'emplacement de `react-native`.
//
// Les deux sont NÉCESSAIRES : la première rend le greffon disponible au bloc `plugins {}`,
// la seconde fournit le `classpath` du projet. Supprimer l'une casse l'autre — essayé, et
// Gradle rend alors « Could not find com.android.tools.build:gradle: » avec une version
// vide.
//
// Avec npm les deux chemins coïncident. Avec pnpm, non : le premier tombe dans le magasin
// (`node_modules/.pnpm/@react-native+gradle-plugin@…`), le second sur le lien hissé à la
// racine. Gradle voit alors deux constructions portant le même nom et s'arrête.
//
// On aligne donc la PREMIÈRE sur la résolution de la seconde. Les deux inclusions désignent
// alors le même dossier, et Gradle n'en retient qu'une.
//
// Pourquoi un greffon plutôt qu'une retouche du fichier : `android/` est REGÉNÉRÉ à chaque
// prebuild. Une correction à la main disparaîtrait au suivant, et la panne reviendrait sans
// que personne se souvienne pourquoi.
const { withSettingsGradle } = require('@expo/config-plugins');

const RESOLUTION_LOCALE = "require.resolve('@react-native/gradle-plugin/package.json')";
const RESOLUTION_ANCREE =
  "require.resolve('@react-native/gradle-plugin/package.json', { paths: [require.resolve('react-native/package.json')] })";

module.exports = function withDedoublonnageGradle(config) {
  return withSettingsGradle(config, (cfg) => {
    const avant = cfg.modResults.contents;
    if (!avant.includes(RESOLUTION_LOCALE)) {
      console.warn(
        '[withDedoublonnageGradle] résolution locale introuvable dans settings.gradle — '
        + 'la version de React Native a peut-être changé la forme de la ligne.',
      );
      return cfg;
    }
    cfg.modResults.contents = avant.replace(RESOLUTION_LOCALE, RESOLUTION_ANCREE);
    return cfg;
  });
};
