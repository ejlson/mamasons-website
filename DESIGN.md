# Mamasons Dirty Ice Cream: construction page directions

## Brief

- **Subject.** Mamasons Dirty Ice Cream, a Filipino ice cream parlour from the Maginhawa group,
  with shops in Kentish Town and Chinatown, London. It is named after the *sorbetero*, the
  street seller with a hand-painted pushcart; "dirty ice cream" is the nickname Filipinos gave
  street sorbetes. Ube is the signature flavour, and the Bilog (ice cream in a toasted milk
  bun) is the signature dessert. Time Out ranked it third-best ice cream in London (2025).
- **Job.** A one-screen "coming soon" page while the real site is built: say who this is, that
  the shops are open, where they are, and where to follow. **One screen, no scrolling** (the
  owner's rule).
- **Audience.** Londoners and visitors looking the shop up; the Filipino community; press.
- **Assets.** A brand pack (navy #0F1E37, sage #BEDCB6, pink #FAD7E1, sky #CDE9F3, ube
  #BA93C4, cream #FFFCF4; a bold geometric wordmark face, Fabiola Script, Fabiola Capitols; the
  matryoshka mascot; a pushcart illustration) and our five 3D nesting dolls, traced from the
  logo, with an open-and-line-up animation.

### Assumptions to confirm (flagged `placeholder: true` in `src/data/site.ts`)

- Addresses come from press (91 Kentish Town Road; 32 Newport Court). Postcodes and hours are
  not stated anywhere reliable, so they are left out.
- The Instagram handle is a guess.
- Fonts are stand-ins until the licensed files arrive: Montserrat 900 for the wordmark face,
  Yellowtail for Fabiola Script, Oswald for Fabiola Capitols.

## Three concepts (different territories)

| | A. Nest (mascot) | B. Wet paint (culture/material) | C. Bilog (product) |
|---|---|---|---|
| Idea | The doll holds everything: it opens and four dolls step out, each carrying one thing you need, and the smallest is the website, not ready yet | The page is a sorbetero's cart being sign-painted: the lettering brushes itself on, and the paint is still wet | The page is a Bilog in the press: two toasted bun halves close around a scoop that changes flavour |
| Anchor | the brand's mascot is a matryoshka; we have the real 3D set | sorbetes carts are hand-painted and hand-lettered | the Bilog is their signature; *bilog* means round |
| Signature | the 3D doll opens and lines its family up across the screen; each doll lifts its lid to show its label | lettering paints in with a bristle-edged brush wipe; a drip keeps running at rest | press a flavour: the lid lifts, the scoop swaps, the bun squishes shut with a puff of sugar |
| Motion verb | lift and settle, like a lid | brush on, drip | press and spring back |
| Screenshot | five dolls in a row, the second lifting its lid over "Chinatown" | the notched signboard mid-brush with a wet drip | the bun mid-squish with an ube scoop |
| O / F / Fe / P | 4 / 5 / 4 / 2 | 4 / 4 / 4 / 3 | 4 / 5 / 4 / 2 |

All three are built, so the owner can compare them. A one-screen brief earns no loader; the
signature plays once on arrival (at most about 3 s) and then the page answers the pointer.

## Shared system

- **Palette.** Use the brand pack exactly. Navy is the ink for all text (AA on every pastel; on
  ube it is 6.4:1). Each direction picks one ground: A uses cream, then follows the hovered
  doll's colour; B uses sky, with a cream board; C uses ube.
- **Type.**
  - The wordmark face (Montserrat 900, tracking -0.03em) is the display voice.
  - The script is only for "Dirty Ice Cream" and one short line.
  - Condensed caps (Oswald 500, +0.06em) are for labels that carry information: place names and
    flavours.
  - Body text is Montserrat 500 at 16 to 18px.
- **Motion** (from the Motion and Emil Kowalski skills):
  - **Easing.** Strong ease-out `cubic-bezier(0.23, 1, 0.32, 1)` for entrances, and ease-in-out
    `cubic-bezier(0.77, 0, 0.175, 1)` for moves across the screen.
  - **Springs.** Use springs for squash and lid lifts.
  - **Press feedback.** Buttons press to 0.97.
  - **Entrances.** Nothing grows from scale 0, and staggers are 40 to 60ms.
  - **Performance.** Animate only transform and opacity.
  - **Clock.** One GSAP ticker drives everything.
  - **Reduced motion.** Under reduced motion, everything shows in its final state and nothing
    loops.
- **Hover** only under `(hover: hover)`. On touch, a tap does the same job.
- **One screen.** Every page uses `100svh`. If a very short viewport can't fit the content, the
  page is allowed to scroll rather than clip, so nothing is lost.
