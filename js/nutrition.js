// Points-based food tracking — open formula (not WeightWatchers' proprietary one).
// 1 point ≈ 50 kcal; saturated fat and added sugar push it up; protein and fibre pull it down.
export function calcPoints({ kcal = 0, sat = 0, sugar = 0, protein = 0, fibre = 0 }) {
  const p = kcal / 50 + sat / 3 + sugar / 6 - protein / 12 - fibre / 12;
  return Math.max(0, Math.round(p));
}

export const WEEKLY_BUFFER = 28;

// Free foods cost 0 so hunger is never the reason someone stops. Portions still count.
// [name, serving, kcal, satFat g, sugar g, protein g, fibre g, free]
const RAW = [
  ["Chicken breast, grilled", "100 g", 165, 0, 0, 0, 0, true],
  ["Fish, grilled or steamed", "100 g", 120, 0, 0, 0, 0, true],
  ["Eggs, boiled or poached", "2 eggs", 155, 0, 0, 0, 0, true],
  ["Beans or lentils", "½ cup", 115, 0, 0, 0, 0, true],
  ["Vegetables (non-starchy)", "1 cup", 30, 0, 0, 0, 0, true],
  ["Fruit (apple, banana, naartjie…)", "1 piece", 90, 0, 0, 0, 0, true],
  ["Plain fat-free yoghurt", "175 ml", 95, 0, 0, 0, 0, true],
  ["Rooibos or black coffee, no sugar", "1 cup", 2, 0, 0, 0, 0, true],
  ["Pap (stiff)", "1 cup", 280, 0.2, 0, 6, 3],
  ["Samp & beans", "1 cup", 260, 0.3, 1, 10, 9],
  ["Brown bread", "1 slice", 80, 0.2, 1, 3.5, 2],
  ["White bread", "1 slice", 85, 0.2, 1.5, 3, 0.8],
  ["Rice, cooked", "1 cup", 205, 0.1, 0, 4, 0.6],
  ["Pasta, cooked", "1 cup", 220, 0.3, 1, 8, 2.5],
  ["Potato, baked", "1 medium", 160, 0, 2, 4, 4],
  ["Slap chips", "medium", 450, 5, 0, 5, 4],
  ["Mealie (corn on the cob)", "1 cob", 100, 0.2, 5, 3.5, 2.5],
  ["Oats", "½ cup dry", 150, 0.5, 0.5, 5, 4],
  ["Weet-Bix", "2 biscuits", 130, 0.2, 1.5, 4, 4],
  ["Rusk (buttermilk)", "1 rusk", 130, 2.5, 6, 2.5, 1],
  ["Boerewors", "100 g", 300, 10, 0, 15, 0],
  ["Biltong", "30 g", 90, 1, 0, 17, 0],
  ["Droëwors", "30 g", 160, 6, 0, 12, 0],
  ["Braaibroodjie", "1", 350, 9, 4, 13, 2],
  ["Chakalaka", "½ cup", 60, 0.2, 5, 2, 3],
  ["Bunny chow (quarter)", "1", 750, 10, 6, 28, 7],
  ["Gatsby (quarter)", "1", 900, 12, 8, 30, 6],
  ["Vetkoek, plain", "1", 280, 3, 3, 6, 1],
  ["Koeksister", "1", 200, 3, 18, 2, 0.5],
  ["Pie (steak / chicken)", "1", 450, 12, 3, 15, 1.5],
  ["Cheddar cheese", "30 g", 120, 6, 0, 7, 0],
  ["Peanut butter", "1 tbsp", 95, 1.5, 1.5, 4, 1],
  ["Avocado", "½", 160, 2, 0.5, 2, 7],
  ["Amasi, full cream", "250 ml", 160, 5, 11, 8, 0],
  ["Milk, full cream", "250 ml", 160, 5, 12, 8, 0],
  ["Coffee with milk & 1 sugar", "1 cup", 50, 1, 6, 1.5, 0],
  ["Fizzy cooldrink", "330 ml", 140, 0, 35, 0, 0],
  ["Beer", "340 ml", 150, 0, 0, 1, 0],
  ["Wine", "150 ml", 125, 0, 1, 0, 0],
  ["Chocolate bar", "40 g", 210, 7, 22, 3, 1],
];

export const FOODS = RAW.map(([name, serving, kcal, sat, sugar, protein, fibre, free]) => ({
  name, serving, kcal, free: !!free, points: free ? 0 : calcPoints({ kcal, sat, sugar, protein, fibre }),
}));

// Daily points budget from Mifflin-St Jeor with a ~500 kcal/day deficit and safe floors.
// Age, sex and height are used only in the browser and are NOT stored.
export function dailyKcal({ weight, height, age, sex, activity, losing }) {
  const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === "m" ? 5 : -161);
  const tdee = bmr * Number(activity || 1.2);
  const floor = sex === "m" ? 1500 : 1200;
  return Math.round(Math.max(floor, losing ? tdee - 500 : tdee) / 10) * 10;
}
export function dailyBudget(o) { return Math.round(dailyKcal(o) / 50); }

// Water: about 35 ml per kg of body weight, plus about 500 ml per hour of training.
// Rounded to the nearest 250 ml glass, kept within sensible limits.
export const GLASS_ML = 250;
export function waterGoal({ weight, trainingMinutes = 0, hot = false }) {
  const base = weight ? weight * 35 : 2000;
  const ml = base + (trainingMinutes / 60) * 500 + (hot ? 500 : 0);
  return Math.min(5000, Math.max(1500, Math.round(ml / GLASS_ML) * GLASS_ML));
}
export const WATER_TIPS = [
  "Start the day with a glass before coffee.",
  "Keep a bottle where you can see it: desk, car, gym bag.",
  "Drink a glass with every meal and snack.",
  "Sip 500 ml in the hour before training, and keep sipping during it.",
  "Hot day or a sweaty session? Add an extra 500 ml.",
  "Pale straw-coloured pee is the easiest check that you're on track.",
  "Rooibos, sparkling water and water with lemon all count.",
  "Feeling hungry between meals? Try a glass of water first.",
];

// Her recipes. Points are per serving, worked out with calcPoints from the label totals.
// Add her own in the same shape.
export const RECIPES = [
  {
    name: "Peri-peri chicken and butternut traybake", serves: 4, minutes: 40,
    kcal: 380, points: calcPoints({ kcal: 380, sat: 2, sugar: 7, protein: 38, fibre: 6 }),
    ingredients: ["600 g chicken breast, cubed", "500 g butternut, cubed", "1 red onion, wedges", "1 red pepper, sliced", "2 tbsp peri-peri sauce", "1 tbsp olive oil", "Handful of spinach"],
    steps: ["Heat the oven to 200 °C.", "Toss everything except the spinach with the oil and peri-peri.", "Roast for 30 minutes, turning once.", "Stir through the spinach and serve."],
  },
  {
    name: "Chakalaka shakshuka", serves: 2, minutes: 25,
    kcal: 290, points: calcPoints({ kcal: 290, sat: 3, sugar: 9, protein: 19, fibre: 7 }),
    ingredients: ["1 tin chakalaka (mild or hot)", "1 tin chopped tomatoes", "4 eggs", "1 tsp smoked paprika", "Fresh coriander", "2 slices brown toast, to serve"],
    steps: ["Simmer the chakalaka, tomatoes and paprika in a pan for 8 minutes.", "Make four hollows and crack in the eggs.", "Cover and cook on low for 6–8 minutes until set.", "Top with coriander. Count the toast separately."],
  },
  {
    name: "Bobotie-spiced lentil cottage pie", serves: 4, minutes: 50,
    kcal: 420, points: calcPoints({ kcal: 420, sat: 3, sugar: 10, protein: 24, fibre: 13 }),
    ingredients: ["300 g lean mince", "1 tin brown lentils, drained", "1 onion, grated carrot", "2 tsp curry powder, 1 tsp turmeric", "1 tbsp chutney", "600 g sweet potato, mashed"],
    steps: ["Brown the mince and onion, add carrot and spices.", "Stir in lentils and chutney with a splash of water; simmer 10 minutes.", "Spoon into a dish, top with sweet potato mash.", "Bake at 200 °C for 20 minutes."],
  },
  {
    name: "Overnight oats with amasi and berries", serves: 1, minutes: 5,
    kcal: 330, points: calcPoints({ kcal: 330, sat: 3, sugar: 14, protein: 15, fibre: 7 }),
    ingredients: ["½ cup oats", "½ cup low-fat amasi or plain yoghurt", "¼ cup milk", "Handful of berries", "1 tsp honey", "Pinch of cinnamon"],
    steps: ["Mix everything except the berries in a jar.", "Refrigerate overnight.", "Top with berries in the morning."],
  },
];
