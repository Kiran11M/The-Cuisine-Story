// Shared menu used by the website (index.html) and the QR table-ordering page (order.html).
// PRICES ARE PLACEHOLDERS: update them to match the restaurant's current menu.
// `id` must stay unique and unchanged once orders exist. `img` is optional.
window.MENU_CATEGORIES = [
  { id: "starters", name: "Starters" },
  { id: "bengali", name: "Bengali" },
  { id: "north", name: "North Indian" },
  { id: "chinese", name: "Indo-Chinese" },
  { id: "biryani", name: "Biryani & Rice" },
  { id: "breads", name: "Breads" },
  { id: "dessert", name: "Desserts" },
];

window.MENU = [
  { id: "fish-chop", cat: "starters", name: "Fish Chop", desc: "Kolkata-style crumbed fish croquettes with kasundi", price: 180, veg: false, img: "images/food/fish-chop.jpg" },
  { id: "mughlai-paratha", cat: "starters", name: "Mughlai Paratha", desc: "Flaky paratha stuffed with egg and minced meat, served with aloo curry", price: 220, veg: false, img: "images/food/mughlai-paratha.webp" },
  { id: "chicken-pakora", cat: "starters", name: "Chicken Pakora", desc: "Crisp spiced chicken fritters with green chilli and lemon", price: 240, veg: false, img: "images/food/chicken-pakora.jpg" },
  { id: "seekh-kebab", cat: "starters", name: "Mutton Seekh Kebab", desc: "Minced mutton skewers grilled in the tandoor", price: 320, veg: false, img: "images/food/seekh-kebab.webp" },

  { id: "bengali-thali", cat: "bengali", name: "Bengali Veg Thali", desc: "Rice, dal, aloo bhaja, paneer curry and a seasonal sabzi", price: 260, veg: true, img: "images/food/bengali-thali.webp" },
  { id: "sorshe-pabda", cat: "bengali", name: "Sorshe Pabda", desc: "Pabda fish in a sharp, silky mustard gravy", price: 380, veg: false, img: "images/food/sorshe-pabda.jpg" },
  { id: "bhetki-paturi", cat: "bengali", name: "Bhetki Paturi", desc: "Bhetki fillet in mustard–coconut paste, steamed in banana leaf", price: 420, veg: false },
  { id: "chingri-paturi", cat: "bengali", name: "Chingri Paturi", desc: "Prawns in mustard paste, wrapped in leaf and steamed", price: 400, veg: false, img: "images/food/chingri-paturi.jpg" },
  { id: "chingri-kalia", cat: "bengali", name: "Chingri Kalia", desc: "Prawns in a rich, spicy onion–tomato gravy", price: 420, veg: false, img: "images/food/chingri-kalia.webp" },
  { id: "kosha-mangsho", cat: "bengali", name: "Kosha Mangsho", desc: "Slow-cooked spicy mutton, Kolkata style", price: 420, veg: false, img: "images/food/kosha-mangsho.jpg" },
  { id: "bhetki-jhal", cat: "bengali", name: "Bhetki Jhal", desc: "Bhetki in a fiery mustard–chilli curry", price: 400, veg: false },
  { id: "kochu-bhapa", cat: "bengali", name: "Kochu Bhapa with Chingri", desc: "Steamed taro mash with prawns and mustard", price: 320, veg: false },
  { id: "dhokar-dalna", cat: "bengali", name: "Dhokar Dalna", desc: "Lentil cakes simmered in a gently spiced gravy", price: 240, veg: true, img: "images/food/dhokar-dalna.webp" },
  { id: "kochu-bata", cat: "bengali", name: "Kochu Bata", desc: "Taro paste with mustard, green chilli and mustard oil", price: 220, veg: true },
  { id: "aloo-posto", cat: "bengali", name: "Aloo Posto", desc: "Potatoes cooked in poppy-seed paste", price: 200, veg: true },

  { id: "butter-chicken", cat: "north", name: "Butter Chicken", desc: "Tandoori chicken in a creamy tomato-butter gravy", price: 340, veg: false },
  { id: "paneer-butter-masala", cat: "north", name: "Paneer Butter Masala", desc: "Soft paneer in a rich makhani gravy", price: 280, veg: true },
  { id: "dal-makhani", cat: "north", name: "Dal Makhani", desc: "Black lentils slow-cooked with butter", price: 240, veg: true },

  { id: "chilli-chicken-dry", cat: "chinese", name: "Chilli Chicken (Dry)", desc: "Crispy chicken tossed with dry red chilli and curry leaves", price: 280, veg: false, img: "images/food/chilli-chicken-dry.jpg" },
  { id: "hakka-noodles", cat: "chinese", name: "Mixed Hakka Noodles", desc: "Wok-tossed noodles with chicken, egg and peppers", price: 280, veg: false, img: "images/food/hakka-noodles.webp" },
  { id: "veg-manchurian", cat: "chinese", name: "Veg Manchurian", desc: "Vegetable dumplings in a tangy garlic sauce", price: 220, veg: true },

  { id: "chicken-biryani", cat: "biryani", name: "Kolkata Chicken Biryani", desc: "Fragrant rice, tender chicken and the signature potato", price: 320, veg: false, img: "images/food/chicken-biryani.webp" },
  { id: "mutton-biryani", cat: "biryani", name: "Kolkata Mutton Biryani", desc: "Aromatic rice, mutton, potato and egg", price: 380, veg: false },
  { id: "mixed-fried-rice", cat: "biryani", name: "Mixed Fried Rice", desc: "Fried rice with prawn, chicken and egg", price: 280, veg: false, img: "images/food/mixed-fried-rice.webp" },
  { id: "steamed-rice", cat: "biryani", name: "Steamed Rice", desc: "Plain steamed rice", price: 100, veg: true },

  { id: "ghugni-paratha", cat: "breads", name: "Paratha with Ghugni", desc: "Flaky paratha with spiced yellow-pea curry and green chutney", price: 160, veg: true, img: "images/food/ghugni-paratha.jpg" },
  { id: "luchi", cat: "breads", name: "Luchi (4 pcs)", desc: "Puffed fried bread", price: 90, veg: true },
  { id: "butter-naan", cat: "breads", name: "Butter Naan", desc: "Fresh from the tandoor", price: 60, veg: true },

  { id: "mishti-doi", cat: "dessert", name: "Mishti Doi", desc: "Sweet caramelised baked yoghurt", price: 90, veg: true },
  { id: "rosogolla", cat: "dessert", name: "Rosogolla (2 pcs)", desc: "Soft cottage-cheese balls in light syrup", price: 80, veg: true },
];
