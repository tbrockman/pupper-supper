/* ---------- nutrient framework (AAFCO 2016 adult maintenance, per 1,000 kcal ME) ---------- */
export const NUTS = [
 ["Energy","kcal",null,null],["Protein","g",45,null],["Fat","g",13.8,null],
 ["Calcium","mg",1250,6250],["Phosphorus","mg",1000,4000],["Potassium","mg",1500,null],
 ["Sodium","mg",200,null],["Magnesium","mg",150,null],["Iron","mg",10,null],
 ["Zinc","mg",20,null],["Copper","mg",1.83,null],["Manganese","mg",1.25,null],
 ["Selenium","µg",80,500],["Iodine","µg",250,2750],["Vitamin A","IU",1250,62500],
 ["Vitamin D","IU",125,750],["Vitamin E","IU",12.5,null],["Thiamin B1","mg",0.56,null],
 ["Riboflavin B2","mg",1.3,null],["Vitamin B6","mg",0.375,null],["Vitamin B12","µg",7,null],
 ["Folate","µg",54,null],["Choline","mg",340,null],["EPA+DHA","g",0.3,null] // 0.3 = common target, not AAFCO
];
export const iKcal=0, iCa=3, iP=4;

/** Source for the profile the analysis compares against. */
export const AAFCO_URL = "https://www.aafco.org/wp-content/uploads/2023/01/Model_Bills_and_Regulations_Agenda_Midyear_2015_Final_Attachment_A.__Proposed_revisions_to_AAFCO_Nutrient_Profiles_PFC_Final_070214.pdf";

/** Mass units: grams per unit. */
export const UNITS = { g:1, kg:1000, oz:28.3495, lb:453.592 };
/** Units the dog's own weight can be entered in (kg per unit). */
export const WEIGHT_UNITS = { kg:1, lb:0.453592 };
/** Feeding periods: days per period. */
export const PERIODS = { day:1, week:7, month:30.4375 };

export const DEFAULT_TITLE = "Pupper Supper";

export function newId(){ return Math.random().toString(36).slice(2); }

/**
 * Build a food item.
 *  amount  = a number or small arithmetic expression, e.g. "400*2/10"
 *  unit    = key of UNITS; per = key of PERIODS
 *  per100  = 24 numbers in NUTS order, per 100 g
 */
export function f(name, amount, unit, per, src, per100){
  return {id:newId(), name, amount:String(amount), unit, per, src, per100};
}

/** Empty item for "Custom food". */
export function blankFood(){
  return f("New food", "0", "g", "day", "A manually added food item", NUTS.map(()=>0));
}

export const EMPTY = { title: DEFAULT_TITLE, weight: 20, weightUnit: "kg", activity: 1.6, foods: [] };

/* ---------- example recipe: a 22 kg active dog on a mixed home-cooked / kibble diet ---------- */
/* Home-cooked items are cooked as a 10-cup batch of which 2 cups are fed a day (hence *2/10). */
export const EXAMPLE = {
 title: DEFAULT_TITLE, weight:23, weightUnit:"kg", activity:2.4,
 foods:[
 f("Canned pumpkin","400*2/10","g","day","USDA 168534 · 400 g per batch",
   [34,1.1,.28,26,35,206,5,23,1.39,.17,.11,.15,.2,1,2620,0,1.6,.03,.05,.06,0,12,8,0]),
 f("Sweet potato, peeled","860*2/10","g","day","USDA 168482 · 860 g per batch",
   [86,1.6,.1,30,47,337,55,25,.6,.3,.15,.26,.6,1,2360,0,.4,.08,.06,.21,0,11,12,0]),
 f("Chicken liver","133*2/10","g","day","USDA 171060 raw · 133 g per batch",
   [119,16.9,4.8,8,297,230,71,19,9,2.7,.49,.26,55,10,11000,20,1,.3,1.78,.85,16.6,588,194,.1]),
 f("Chicken hearts","133*2/10","g","day","~USDA raw · 133 g per batch",
   [153,15.6,9.3,12,177,176,74,15,5.9,6.6,.5,.1,43,4,30,0,1,.15,.73,.36,7.3,72,194,.03]),
 f("Extra-lean ground beef (95%)","454*2/10","g","day","USDA 171791 raw · 454 g per batch",
   [137,21.4,5,12,175,330,66,20,2.4,5.1,.08,.01,17,3,0,4,.3,.05,.16,.36,2.2,6,65,0]),
 f("Large eggs","6*50*2/10","g","day","USDA 171287 · 6 eggs × 50 g per batch",
   [143,12.6,9.5,56,198,138,142,12,1.75,1.3,.07,.03,31,50,540,82,1.6,.04,.46,.17,.89,47,294,.04]),
 f("Jasmine rice, dry","139*2/10","g","day","USDA 169756 · ¾ cup dry per batch",
   [365,7.1,.7,28,115,115,5,25,.8,1.1,.22,1.1,15,1,0,0,.2,.07,.05,.16,0,8,6,0]),
 f("Mixed veg: carrot, peas, corn, green beans","500*2/10","g","day","~USDA average of the four · 500 g per batch",
   [55,2.5,.4,25,55,220,35,18,.8,.4,.07,.2,.6,1,1500,0,.5,.08,.06,.1,0,25,15,0]),
 f("Green beans","250*2/10","g","day","USDA 169961 · 250 g per batch",
   [33,1.8,.2,37,38,211,3,25,1,.24,.07,.21,.2,.5,120,0,.6,.08,.1,.14,0,33,15,0]),
 f("Calcium carbonate powder","1","g","day","40% elemental calcium",
   [0,0,0,40000,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]),
 f("Carna4 Chicken kibble","2*116","g","day","Carna4 guaranteed analysis · 2 cups × 116 g · 500 kcal/cup",
   [430,29,15,1300,1000,800,330,130,12,19,1.4,2.6,80,220,1600,110,34,.70,.61,.76,22,100,190,1.08]),
 f("Kirkland wet pâté","374","g","week","~complete food at AAFCO minimums · one 374 g can",
   [110,9,6,250,200,165,60,17,1.1,2.2,.2,.14,9,28,138,14,1.4,.06,.14,.04,.8,6,37,0]),
 f("Cesar wet tray","100","g","week","~complete food at AAFCO minimums · one 100 g tray",
   [90,8,4,200,160,135,50,14,.9,1.8,.16,.11,7,23,113,11,1.1,.05,.12,.03,.6,5,31,0]),
 f("Beef chew stick","2*20","g","week","~estimate · 2 sticks × 20 g",
   [300,65,4,50,150,100,200,10,2,3,.1,.02,20,5,0,0,.2,.02,.1,.1,1,5,30,0]),
 f("Duck stick","2*8","g","week","~estimate · 2 sticks × 8 g",
   [330,55,10,30,300,300,300,20,4,3,.2,.05,20,5,100,10,.3,.1,.3,.4,1,10,80,0]),
 f("Freeze-dried beef liver bites","35","g","week","~freeze-dried beef liver · 35 × 1 g bites",
   [350,70,12,18,1300,1100,240,63,17,14,34,1.1,140,30,58000,170,2.5,.7,9.7,3.7,200,1000,1150,0]),
]};
