"use strict";
/* ============ constants: wiki, grades, costs, stats, slots ============ */
const WIKI = "https://lobotomycorporation.wiki.gg";
const API  = WIKI + "/api.php";
const GCOLOR = {ZAYIN:"var(--zayin)",TETH:"var(--teth)",HE:"var(--he)",WAW:"var(--waw)",ALEPH:"var(--aleph)",GIFT:"var(--gift)"};
const GHEX   = {ZAYIN:"#5df04e",TETH:"#3aaef8",HE:"#f8ef42",WAW:"#b44ff2",ALEPH:"#f24444",GIFT:"#f2c14e"};
const D20MAP = n => n<=6?"ZAYIN" : n<=11?"TETH" : n<=16?"HE" : n<=18?"WAW" : "ALEPH";
/* the in-game risk classification signs */
const RISK_IMG = {ZAYIN:"assets/risk-zayin.png", TETH:"assets/risk-teth.png", HE:"assets/risk-he.png",
  WAW:"assets/risk-waw.png", ALEPH:"assets/risk-aleph.png"};
function riskBadge(grade){
  return RISK_IMG[grade] ? '<img class="riskbadge" src="'+RISK_IMG[grade]+'" alt="'+grade+'">' : '';
}
const CATS = {1:"GIFT",2:"WEAPON",3:"SUIT",4:"WEAPON + SUIT"};
const CLASSES = ["ZAYIN","TETH","HE","WAW","ALEPH"];

/* the four merged LC stats — the merged score IS the D&D stat.
   Colors and icons follow the game: Fortitude red, Justice cyan, Prudence white, Temperance purple. */
const STATS = [
  {k:"FOR", name:"Fortitude",  sub:"STR + CON",  color:"#e8433f", icon:"assets/stat-for.png"},
  {k:"JUS", name:"Justice",    sub:"DEX",        color:"#3fd8e0", icon:"assets/stat-jus.png"},
  {k:"PRU", name:"Prudence",   sub:"WIS",        color:"#efe9d8", icon:"assets/stat-pru.png"},
  {k:"TEM", name:"Temperance", sub:"INT + CHA",  color:"#a85fc2", icon:"assets/stat-tem.png"}
];
const STAT_NAME = Object.fromEntries(STATS.map(s=>[s.k,s.name]));

/* damage type → governing stat: weapons use the type they deal,
   suits use the type they guard against best */
const DTYPE2STAT = {Red:"FOR", White:"PRU", Black:"TEM", Pale:"JUS"};
const STAT2DTYPE = {FOR:"Red", PRU:"White", TEM:"Black", JUS:"Pale"};
const DTYPE_ICON = t => "assets/"+t+"DamageTypeIcon.png";
const DTYPE_COLOR = {Red:"#e8433f", White:"#efe9d8", Black:"#a85fc2", Pale:"#3fd8e0"};

/* numeral grades: I 8–9 · II 10–12 · III 13–15 · IV 16–17 · V 18–20 · EX 21+ */
const GRADE_NAMES = ["—","I","II","III","IV","V","EX"];
function gradeRank(score){
  return score<=9?1 : score<=12?2 : score<=15?3 : score<=17?4 : score<=20?5 : 6;
}
/* lower bound of each grade band (for progress-to-next display) */
const GRADE_FLOOR = {1:8, 2:10, 3:13, 4:16, 5:18, 6:21};

/* the six D&D abilities map onto the four merged stats — the merged score IS the ability score */
const ABIL2MERGED = {STR:"FOR", CON:"FOR", DEX:"JUS", WIS:"PRU", INT:"TEM", CHA:"TEM"};
const SAVES = ["STR","DEX","CON","INT","WIS","CHA"];

/* standard 5e skill list; each follows its parent ability into its new home */
const SKILLS = [
  {id:"athletics",      name:"Athletics",       abil:"STR"},
  {id:"acrobatics",     name:"Acrobatics",      abil:"DEX"},
  {id:"sleight",        name:"Sleight of Hand", abil:"DEX"},
  {id:"stealth",        name:"Stealth",         abil:"DEX"},
  {id:"arcana",         name:"Arcana",          abil:"INT"},
  {id:"history",        name:"History",         abil:"INT"},
  {id:"investigation",  name:"Investigation",   abil:"INT"},
  {id:"nature",         name:"Nature",          abil:"INT"},
  {id:"religion",       name:"Religion",        abil:"INT"},
  {id:"animal",         name:"Animal Handling", abil:"WIS"},
  {id:"insight",        name:"Insight",         abil:"WIS"},
  {id:"medicine",       name:"Medicine",        abil:"WIS"},
  {id:"perception",     name:"Perception",      abil:"WIS"},
  {id:"survival",       name:"Survival",        abil:"WIS"},
  {id:"deception",      name:"Deception",       abil:"CHA"},
  {id:"intimidation",   name:"Intimidation",    abil:"CHA"},
  {id:"performance",    name:"Performance",     abil:"CHA"},
  {id:"persuasion",     name:"Persuasion",      abil:"CHA"}
];

/* what a gift's small boost can point at: AC, initiative, a stat score, or a single skill */
const BONUS_TARGETS = [
  {v:"AC", label:"AC"}, {v:"HP", label:"Max HP"}, {v:"INIT", label:"Initiative"},
  {v:"PECAP", label:"PE cap"},
  ...STATS.map(s=>({v:s.k, label:s.name+" score"})),
  ...SKILLS.map(s=>({v:s.id, label:s.name}))
];
const BONUS_LABEL = Object.fromEntries(BONUS_TARGETS.map(b=>[b.v, b.label]));

/* print cost per single item: base − Temperance INT-mod */
const PRINT_BASE = {ZAYIN:5, TETH:12, HE:20, WAW:30, ALEPH:40};

/* synthesis price menu (spent from the shared PE pool) */
const SYNTH_COST = {GIFT:60, ZAYIN:60, TETH:80, HE:120, WAW:150, ALEPH:170};

/* trimmed gift-slot taxonomy. Eye is permanently occupied by 「Your Eyes」.
   `pool` is the wiki slot each cell draws from (Mouth uses Mouth 2's pool, Hand uses Hand 2's). */
const SLOTS = [
  {id:"eye",    label:"Eye",    pool:"Eye"},
  {id:"hat",    label:"Hat",    pool:"Hat"},
  {id:"mouth2", label:"Mouth",  pool:"Mouth 2"},
  {id:"cheek",  label:"Cheek",  pool:"Cheek"},
  {id:"brooch", label:"Brooch", pool:"Brooch"},
  {id:"hand2",  label:"Hand",   pool:"Hand 2"}
];
/* normalize a wiki slot string ("Mouth 2", "Cheek") for comparison */
function slotNorm(s){ return String(s||"").toLowerCase().replace(/[^a-z0-9]/g,""); }
function giftFitsSlot(recSlot, cell){
  return slotNorm(recSlot) === slotNorm(cell.pool || cell.label);
}

/* ============ seed roster (weapons only — recovery fills the rest) ============ */
function w(name,grade,file,page,src){return {name,type:"weapon",grade,img:WIKI+"/images/thumb/"+file+"/200px-"+file,link:WIKI+"/wiki/"+page+"#E.G.O_Weapon",src};}
const SEED = [
w("Penitence","ZAYIN","EGOWeaponPenitence.png","One_Sin_and_Hundreds_of_Good_Deeds","One Sin and Hundreds of Good Deeds"),
w("Soda","ZAYIN","EGOWeaponSoda.png","Opened_Can_of_WellCheers","Opened Can of WellCheers"),
w("Wingbeat","ZAYIN","EGOWeaponWingbeat.png","Fairy_Festival","Fairy Festival"),
w("Tough","TETH","EGOWeaponTough.png","You%27re_Bald...","You're Bald..."),
w("Fourth Match Flame","TETH","EGOWeaponFourthMatchFlame.png","Scorched_Girl","Scorched Girl"),
w("Solitude","TETH","EGOWeaponLoneliness.png","Old_Lady","Old Lady"),
w("Red Eyes","TETH","EGOWeaponRedEyes.png","Spider_Bud","Spider Bud"),
w("Horn","TETH","EGOWeaponHorn.png","Beauty_and_the_Beast","Beauty and the Beast"),
w("Wrist Cutter","TETH","EGOWeaponWristCuter.png","Bloodbath","Bloodbath"),
w("Regret","TETH","EGOWeaponRegret.png","Forsaken_Murderer","Forsaken Murderer"),
w("Beak","TETH","EGOWeaponBeak.png","Punishing_Bird","Punishing Bird"),
w("Fragments from Somewhere","TETH","EGOWeaponSomewhereSpear.png","Fragment_of_the_Universe","Fragment of the Universe"),
w("Lantern","TETH","EGOWeaponLantern.png","Meat_Lantern","Meat Lantern"),
w("Today's Expression","TETH","EGOWeaponToday%27sExpression.png","Today%27s_Shy_Look","Today's Shy Look"),
w("Engulfing Dream","TETH","EGOWeaponRapturousDream.png","Void_Dream","Void Dream"),
w("Cherry Blossoms","TETH","EGOWeaponCherryBlossom.png","Grave_of_Cherry_Blossoms","Grave of Cherry Blossoms"),
w("SO CUTE!!!","TETH","EGOWeaponCUTE%21%21%21%21.png","Ppodae","Ppodae"),
w("Screaming Wedge","HE","EGOWeaponScreamingWedge.png","The_Lady_Facing_the_Wall","The Lady Facing the Wall"),
w("Life for a Daredevil","HE","EGOWeaponLifefortheDareDevil.png","Crumbling_Armor","Crumbling Armor"),
w("Bear Paws","HE","EGOWeaponBearPaw.png","Happy_Teddy_Bear","Happy Teddy Bear"),
w("Sanguine Desire","HE","EGOWeaponBloodyDesire.png","The_Red_Shoes","The Red Shoes"),
w("Syrinx","HE","EGOWeaponCrier.png","Nameless_Fetus","Nameless Fetus"),
w("Harmony","HE","EGOWeaponHarmony.png","Singing_Machine","Singing Machine"),
w("Logging","HE","EGOWeaponLogging.png","Warm-hearted_Woodsman","Warm-hearted Woodsman"),
w("Frost Splinter","HE","EGOWeaponFrostShard.png","The_Snow_Queen","The Snow Queen"),
w("Grinder Mk4","HE","EGOWeaponGrinderMk4.png","All-Around_Helper","All-Around Helper"),
w("Christmas","HE","EGOWeaponChristmas.png","Rudolta_of_the_Sleigh","Rudolta of the Sleigh"),
w("Our Galaxy","HE","EGOWeaponGalaxy.png","Child_of_the_Galaxy","Child of the Galaxy"),
w("Laetitia","HE","EGOWeaponLaetitia.png","Laetitia","Laetitia"),
w("Gaze","HE","EGOWeaponGaze.png","Schadenfreude","Schadenfreude"),
w("Harvest","HE","EGOWeaponHarvest.png","Scarecrow_Searching_for_Wisdom","Scarecrow Searching for Wisdom"),
w("Pleasure","HE","EGOWeaponPleasure.png","Porccubus","Porccubus"),
w("Solemn Lament","WAW","EGOWeaponSolemnVow.png","The_Funeral_of_the_Dead_Butterflies","The Funeral of the Dead Butterflies"),
w("Magic Bullet","WAW","EGOWeaponMagicBullet.png","Der_Freisch%C3%BCtz","Der Freischütz"),
w("In the Name of Love and Hate","WAW","EGOWeaponIntheNameofLoveandHate.png","The_Queen_of_Hatred","The Queen of Hatred"),
w("Lamp","WAW","EGOWeaponLamp.png","Big_Bird","Big Bird"),
w("Green Stem","WAW","EGOWeaponGreenStem.png","Snow_White%27s_Apple","Snow White's Apple"),
w("Hornet","WAW","EGOWeaponHornet.png","Queen_Bee","Queen Bee"),
w("Faint Aroma","WAW","EGOWeaponReverberation.png","Alriune","Alriune"),
w("Crimson Scar","WAW","EGOWeaponCrimsonScar.png","Little_Red_Riding_Hooded_Mercenary","Little Red Riding Hooded Mercenary"),
w("Cobalt Scar","WAW","EGOWeaponBlueScar.png","Big_and_Will_be_Bad_Wolf","Big and Will be Bad Wolf"),
w("Spore","WAW","EGOWeaponSpore.png","The_Little_Prince","The Little Prince"),
w("Black Swan","WAW","EGOWeaponBlackSwan.png","Dream_of_a_Black_Swan","Dream of a Black Swan"),
w("Ecstasy","WAW","EGOWeaponEcstasy.png","The_Dreaming_Current","The Dreaming Current"),
w("Heaven","WAW","EGOWeaponHeaven.png","The_Burrowing_Heaven","The Burrowing Heaven"),
w("The Sword Sharpened with Tears","WAW","EGOWeaponSwordSharpenedbyTears.png","The_Knight_of_Despair","The Knight of Despair"),
w("Exuviae","WAW","EGOWeaponShedSkin.png","The_Naked_Nest","The Naked Nest"),
w("Diffraction","WAW","EGOWeaponDiffraction.png","Dimensional_Refraction_Variant","Dimensional Refraction Variant"),
w("Feather of Honor","WAW","EGOWeaponFeatherofHonor.png","The_Firebird","The Firebird"),
w("Discord","WAW","EGOWeaponDiscord.png","Yin","Yin"),
w("Moonlight","WAW","EGOWeaponMoonlight.png","Il_Pianto_della_Luna","Il Pianto della Luna"),
w("Hypocrisy","WAW","EGOWeaponHypocrisy.png","Parasite_Tree","Parasite Tree"),
w("Amita","WAW","EGOWeaponAmita.png","Clouded_Monk","Clouded Monk"),
w("Justitia","ALEPH","EGOWeaponJustitia.png","Judgement_Bird","Judgement Bird"),
w("Gold Rush","ALEPH","EGOWeaponGoldRush.png","The_King_of_Greed","The King of Greed"),
w("Mimicry","ALEPH","EGOWeaponMimicry.png","Nothing_There","Nothing There"),
w("Da Capo","ALEPH","EGOWeaponDaCapo.png","The_Silent_Orchestra","The Silent Orchestra"),
w("Smile","ALEPH","EGOWeaponTheSmile.png","Mountain_of_Smiling_Bodies","Mountain of Smiling Bodies"),
w("CENSORED","ALEPH","EGOWeaponCensored.png","CENSORED","CENSORED"),
w("Sound of a Star","ALEPH","EGOWeaponSoundofaStar.png","Blue_Star","Blue Star"),
w("Pink","ALEPH","EGOWeaponPinks.png","Army_in_Black","Army in Black")
];
