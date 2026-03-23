Design system and architecture for Laudo Amigável health app

## Colors (HSL in index.css)
- Primary: sage green #0F6E56 → 160 75% 24%
- Background: off-white #F9F7F4 → 40 33% 97%
- Attention (amber): 38 80% 55% — NEVER use red for attention
- Follow-up (coral): 0 50% 55%

## Fonts
- Headings: Lora (serif) via Google Fonts
- Body: DM Sans (sans-serif) via Google Fonts

## Architecture
- State: Zustand store with persist (src/stores/examStore.ts)
- AI: Claude API via Edge Function (supabase/functions/analyze-exam)
- Types: src/types/health.ts (v2 with sistema, trilha_discreta, Score, Checkin)
- Pages: HomePage, UploadPage, ResultPage, EvolutionPage, ProfilePage, ScorePage
- Components: CheckinSheet (post-upload questionnaire), ExamCard (with badges)
- Mobile-first: max-w-md centered, bottom nav bar

## v2 Features
- Score de Saúde (6 pilares: exames, sono, estresse, atividade, alimentação, adesão)
- Check-in sheet auto-shown after exam analysis
- Expandable achados with régua de referência and trilha discreta
- Sparklines on evolution page
- System filters (Cardiovascular, Hepatobiliar, etc.)
- Organ evolution trails
- Copy questions button
- Rotating loading messages
- Grouped achados by status (normal/atencao/acompanhamento)

## API Key
- ANTHROPIC_API_KEY stored as Edge Function secret (not in frontend)
