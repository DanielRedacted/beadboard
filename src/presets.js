// Per-medium defaults. A medium's palette here only seeds palettes/<medium>.json on first use;
// after that the saved palette (with Jess's additions) is what new designs start from.
// note: hex values are screen approximations of the physical colors; edit them in-app to match real beads.

const pal = s => s.trim().split('\n').map(l => { const [hex, ...n] = l.trim().split(' '); return { name: n.join(' '), hex }; });

export const MEDIA = {
  perler: {
    label: 'Perler beads (iron)',
    pitch: 5, // mm between peg centers, editable in the print dialog
    lattice: 'straight',
    sizes: [
      { label: 'Square pegboard 29 × 29', board: { shape: 'rect', w: 29, h: 29 } },
      { label: '4 joined boards 58 × 58', board: { shape: 'rect', w: 58, h: 58 } },
      { label: 'Small square 14 × 14', board: { shape: 'rect', w: 14, h: 14 } },
      { label: 'Large hexagon, 15 per side', board: { shape: 'hex', n: 15 }, lattice: 'bond' },
      { label: 'Small hexagon, 8 per side', board: { shape: 'hex', n: 8 }, lattice: 'bond' },
    ],
    palette: pal(`
      #f1f1f1 White
      #e0dea9 Cream
      #ecd800 Yellow
      #f1aa0c Cheddar
      #ed6120 Orange
      #bf2e40 Red
      #ff3956 Hot Coral
      #ff8283 Blush
      #eebab2 Peach
      #f6b3dd Light Pink
      #dd6698 Bubblegum
      #e44892 Pink
      #a5294d Raspberry
      #a24b9c Plum
      #604089 Purple
      #8a72c1 Pastel Lavender
      #6384c1 Periwinkle
      #3370c0 Light Blue
      #2b89c6 Turquoise
      #93c8d4 Toothpaste
      #2b3f87 Dark Blue
      #56ba9f Light Green
      #76c882 Pastel Green
      #6cbe13 Kiwi Lime
      #4fad42 Bright Green
      #1c753e Dark Green
      #068f5e Parrot Green
      #bc9371 Tan
      #d08a2d Butterscotch
      #815d34 Light Brown
      #8c372c Rust
      #513931 Brown
      #8a8d91 Grey
      #4f5155 Dark Grey
      #2e2f32 Black
    `),
  },
  fuse: {
    label: 'Water-fuse beads (spray)',
    pitch: 5,
    lattice: 'straight',
    sizes: [
      { label: 'Square tray 20 × 20', board: { shape: 'rect', w: 20, h: 20 } },
      { label: 'Square tray 30 × 30', board: { shape: 'rect', w: 30, h: 30 } },
      { label: 'Hex tray, 10 per side', board: { shape: 'hex', n: 10 }, lattice: 'bond' },
    ],
    palette: pal(`
      #f4f4f0 White
      #fdf0a0 Light Yellow
      #f9d71c Yellow
      #f7941d Orange
      #e2231a Red
      #f7a8c4 Pink
      #e5418d Hot Pink
      #f9c8a6 Peach
      #b38bd6 Lavender
      #7b3f98 Purple
      #a7d8f0 Light Blue
      #1e88d2 Blue
      #1b2f6e Navy
      #2cc4c4 Turquoise
      #b5e61d Lime
      #3db54a Green
      #1e6b34 Dark Green
      #d9b48a Tan
      #8b5a2b Brown
      #a5a5a5 Grey
      #555555 Dark Grey
      #1a1a1a Black
    `),
  },
  lego: {
    label: 'LEGO 1×1',
    pitch: 8,
    lattice: 'straight', // studs can't be offset by half a stud, so no running bond or hexagon boards
    sizes: [
      { label: 'Baseplate 16 × 16', board: { shape: 'rect', w: 16, h: 16 } },
      { label: 'Baseplate 32 × 32', board: { shape: 'rect', w: 32, h: 32 } },
      { label: 'Baseplate 48 × 48', board: { shape: 'rect', w: 48, h: 48 } },
    ],
    // BrickLink / Rebrickable names and reference colors for solid colors sold as 1×1 parts.
    palette: pal(`
      #ffffff White
      #05131d Black
      #a0a5a9 Light Bluish Gray
      #6c6e68 Dark Bluish Gray
      #c91a09 Red
      #720e0f Dark Red
      #ff698f Coral
      #fe8a18 Orange
      #a95500 Dark Orange
      #f8bb3d Bright Light Orange
      #f2cd37 Yellow
      #fff03a Bright Light Yellow
      #dfeea5 Yellowish Green
      #bbe90b Lime
      #4b9f4a Bright Green
      #237841 Green
      #184632 Dark Green
      #a0bcac Sand Green
      #9b9a5a Olive Green
      #008f9b Dark Turquoise
      #36aebf Medium Azure
      #078bc9 Dark Azure
      #9fc3e9 Bright Light Blue
      #5a93db Medium Blue
      #0055bf Blue
      #6074a1 Sand Blue
      #0a3463 Dark Blue
      #e1d5ed Lavender
      #ac78ba Medium Lavender
      #3f3691 Dark Purple
      #923978 Magenta
      #c870a0 Dark Pink
      #e4adc8 Bright Pink
      #f6d7b3 Light Nougat
      #d09168 Nougat
      #aa7d55 Medium Nougat
      #e4cd9e Tan
      #958a73 Dark Tan
      #582a12 Reddish Brown
      #352100 Dark Brown
    `),
  },
};

// LEGO part types. Only plates stack (one plate is 3.2 mm tall on an 8 mm stud pitch).
export const PARTS = {
  plate: { label: 'Plates', unit: 'plate' },
  tile: { label: 'Square tiles', unit: 'tile' },
  round: { label: 'Round tiles', unit: 'round tile' },
};

export const mediumLabel = d => (d.medium === 'lego' ? `LEGO 1×1 ${PARTS[d.part || 'plate'].label.toLowerCase()}` : MEDIA[d.medium].label);
