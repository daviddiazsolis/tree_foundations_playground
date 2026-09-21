# Tree & Ensemble Foundations

Interactive microsite (English / Spanish, dark / light) that walks through entropy, ID3, CART and Gini, overfitting and pruning, bagging and random forest, AdaBoost, gradient boosting, variable importance and a bonus track on C5.0 with the `c50py` package. Part of the ML & AI Learning Hub.

Same stack as the other playgrounds: Vite + React 19 + Tailwind 4 + lucide-react + motion. MathJax is loaded from cdnjs.

## Structure

- `src/components/` shell of the site (hero, translation widget, sandbox link, notebooks, references, footer) in the hub template.
- `src/components/Playground.tsx` mounts the tab engine and re-mounts it when the language changes, keeping tab and step.
- `src/engine/body.es.html`, `body.en.html` content of the nine tabs; `engine.es.js`, `engine.en.js` the live computations (token-identical except for displayed strings); `data.es.json`, `data.en.json` the two datasets, the churn case and the precomputed trees; `engine.css` the styles, scoped under `.tfp` and mapped to the hub palette (zinc, amber accent).
- `notebooks/` the six Colab notebooks and the assignment linked from the site.

## Run

```
npm install
npm run dev
npm run build
```

## Publish (same flow as the other playgrounds)

1. Create the GitHub repo `daviddiazsolis/tree_foundations_playground` (empty, no README).
2. In this folder: `git init`, `git add .`, `git commit -m "Tree & Ensemble Foundations"`, `git branch -M main`, `git remote add origin https://github.com/daviddiazsolis/tree_foundations_playground.git`, `git push -u origin main`.
3. In Vercel: Add New Project, import the repo, framework Vite, deploy. The project name `tree-foundations-playground` gives the URL `https://tree-foundations-playground.vercel.app`, which is the one already written in `ml_ai_portal/src/utils/sites.ts` and in the Colab links of `NotebooksSection.tsx`.
4. Rebuild and push `ml_ai_portal` so the new card appears in the hub.
