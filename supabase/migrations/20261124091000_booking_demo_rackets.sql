update public.booking_demo_samples
set dataset = jsonb_set(dataset, '{products}', $catalog$
[
  {
    "name": "Bullpadel Unica Vertex",
    "price": 17000,
    "category": "rackets",
    "racketPhotoId": 1
  },
  {
    "name": "Siux Beat Kid Girl 2027",
    "price": 4500,
    "category": "rackets",
    "racketPhotoId": 2,
    "racketSpecifications": [
      "Junior beginners",
      "Round",
      "Lower center",
      "Soft EVA",
      "3K fiberglass",
      "https://www.siuxpadel.com/products/beat-kid-2027"
    ]
  },
  {
    "name": "CWIN Kid’s Racket",
    "price": 1750,
    "category": "rackets",
    "racketPhotoId": 3,
    "racketSpecifications": [
      "Junior players"
    ]
  },
  {
    "name": "Siux Diablo Pro 2026 – Night Blue",
    "price": 15000,
    "category": "rackets",
    "racketPhotoId": 4
  },
  {
    "name": "Siux Valkiria Elite",
    "price": 15000,
    "category": "rackets",
    "racketPhotoId": 5
  },
  {
    "name": "Bullpadel Pearl 27",
    "price": 15000,
    "category": "rackets",
    "racketPhotoId": 6,
    "racketSpecifications": [
      "Advanced attacking players",
      "Diamond",
      null,
      "MultiEVA",
      "Fibrix · fiberglass and carbon",
      "https://www.bullpadel.com/gb/6816-racket-bullpadel-pearl-27.html"
    ]
  },
  {
    "name": "Siux Diablo Pro 2026 – Royal Blue",
    "price": 15000,
    "category": "rackets",
    "racketPhotoId": 7
  },
  {
    "name": "Drop Shot Essential",
    "price": 6500,
    "category": "rackets",
    "racketPhotoId": 8
  },
  {
    "name": "Siux Fenix Pro 2027 – Purple",
    "price": 17000,
    "category": "rackets",
    "racketPhotoId": 9,
    "racketSpecifications": [
      "Advanced power players",
      "Diamond",
      null,
      "Ultra-hard EVA",
      null,
      "https://www.siuxpadel.com/en/pages/leandro-augsburger"
    ]
  },
  {
    "name": "Siux Fenix Pro 2027 – Black",
    "price": 17000,
    "category": "rackets",
    "racketPhotoId": 10,
    "racketSpecifications": [
      "Advanced power players",
      "Diamond",
      null,
      "Ultra-hard EVA",
      null,
      "https://www.siuxpadel.com/en/pages/leandro-augsburger"
    ]
  },
  {
    "name": "Bullpadel Neuron",
    "price": 17000,
    "category": "rackets",
    "racketPhotoId": 11
  },
  {
    "name": "Adidas Drive Black 26",
    "price": 4500,
    "category": "rackets",
    "racketPhotoId": 12,
    "racketSpecifications": [
      "Beginners looking for control",
      "Round",
      "Center",
      "Soft Performance EVA",
      "Fiberglass",
      "https://allforpadel.com/en/110-new-collection?model=metalbone&page=3"
    ]
  },
  {
    "name": "Nox Equation Soft Advanced",
    "price": 7500,
    "category": "rackets",
    "racketPhotoId": 13,
    "racketSpecifications": [
      "Intermediate control players",
      "Round",
      null,
      "HR3 Soft EVA",
      "3K fiberglass",
      "https://noxsport.com/en/products/pala-equation-soft-advanced"
    ]
  },
  {
    "name": "Drop Shot Explorer Pro Attack 2.0",
    "price": 17000,
    "category": "rackets",
    "racketPhotoId": 14
  },
  {
    "name": "Siux Fenix Pro Oasis 2027",
    "price": 22000,
    "category": "rackets",
    "racketPhotoId": 15
  },
  {
    "name": "Siux Electra Pro 2027 – White",
    "price": 17000,
    "category": "rackets",
    "racketPhotoId": 16,
    "racketSpecifications": [
      "Advanced all-court attackers",
      "Hybrid",
      null,
      null,
      null,
      "https://www.siuxpadel.com/en/pages/leandro-augsburger"
    ]
  },
  {
    "name": "Brave – White",
    "price": 2500,
    "category": "rackets",
    "racketPhotoId": 17
  },
  {
    "name": "CWIN Storm",
    "price": 1600,
    "category": "rackets",
    "racketPhotoId": 18
  },
  {
    "name": "Babolat Technical Viper",
    "price": 13000,
    "category": "rackets",
    "racketPhotoId": 19,
    "racketSpecifications": [
      "Technical attackers",
      "Diamond",
      null,
      null,
      null,
      "https://www.babolat.com/es/padel/palas/diamante.html"
    ]
  },
  {
    "name": "Adidas Metalbone Carbon",
    "price": 11000,
    "category": "rackets",
    "racketPhotoId": 20
  },
  {
    "name": "Adidas Metalbone",
    "price": 13000,
    "category": "rackets",
    "racketPhotoId": 21
  }
]
$catalog$::jsonb)
where id = 1;
