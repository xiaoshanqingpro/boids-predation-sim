
"use strict";

/* ============================================================================
 * 鎺犻绔炶禌 鈥斺€?涓や釜鐗堟湰鐨勬暣鍚堜綋
 * ----------------------------------------------------------------------------
 * 绉嶇兢(4 鏂? 鍚勬湁鍚勭殑"鏅鸿兘"灞傛):
 *   1. 妞嬮笩 N 鍙?  鎷撴墤 boids 鈥斺€?姣忓彧鍙笌鏈€杩戠殑 K 鍙簰鍔?涓嶆槸鍗婂緞鍐呭叏閮?,
 *                  鍑濊仛/瀵归綈/鍒嗙 + 閫冮€? 娌℃湁棰嗗ご鐨? 绉╁簭绾潬灞€閮ㄨ鍒欐秾鐜般€? *   2. 闆佺兢 M 鍙?  棰嗛槦鍒?V 缂栭槦, 姣忓彧鏈夊浐瀹氭Ы浣?瑙掕壊璁板繂); 鍗遍櫓鏃剁紪闃熻浣? *                  缁欓€冮€? 鍗遍櫓杩囧悗鑷姩閲嶇粍銆傛楦熺殑瀵圭収缁勩€? *   3. 闅?脳2:      鏈兘 + 鍗忎綔銆傝兘閲忚疆鎹?涓€鍙拷鐚庛€佷竴鍙浼?, 璁句紡鏂归珮閫熻刀寰€
 *                  "鎷︽埅浣?, 鍐插埡鍙?卤60掳 鑸悜绾︽潫銆? *   4. 楣?脳1:      Q-learning 鍦ㄧ嚎瀛︾寧鐗╁亸濂?杩芥楦?/ 杩介泚 / 娓歌崱浼忓嚮 /
 *                  鏀诲嚮绔炰簤鑰?, 宸¤埅姣旈毤蹇€佸啿鍒烘瘮闅煎急銆? *   璁″垎: 妞嬮笩 +1, 闆?+100, 涓夋柟绔炶禌銆傜寷绂戒箣闂磋繕浼氫簰鏀婚┍閬?瑙?6.9)銆? *
 * 鍙嶅埗鏈哄埗(绗?2 杞柊澧?: 绌哄啿鍒烘墸鍒?A) 路 浠ｈ阿鎴愭湰(B) 路 妞嬮笩鍥存敾 mobbing(C)
 *   路 鍐插埡閿佸畾/杩锋儜(D) 路 楣伴毤浜掓敾(E) 鈥斺€?璁?涓€澶存墡杩涢笩缇?涓嶅啀鏄厤璐瑰崍椁愩€? * 绗?4 杞? 鐚涚鏀圭敤閲囨牱鐩爣鑾峰彇(80 涓瀬鍧愭爣鍊欓€夌偣 + 鏂瑰悜婊炲悗 + LOCK_R 閿佸畾);
 *   闆佺兢涓績鍖栭噸鏋?棰嗛槦鏅鸿兘/杞€?apex/骞奸泚鍐呴亾/濞佹厬閿?鏂╅娣蜂贡);
 *   闅肩殑 (1+1)-ES 鍦ㄧ嚎绛栫暐杩涘寲(涓庨拱鐨?Q-learning 骞跺瓨); 闆佸€熸楦熸儕椋炵綉棰勮銆? *   缁嗚妭涓庡父閲忚〃瑙佹枃鏈氦鎺ヨ鏄庣殑"绗?4 杞箣涓€~涔嬩簲"浜旇妭銆? *
 * 鍑犱綍(涓ょ増鏁村悎鐨勫叧閿彇鑸? 鍙敤銆岀幆闈€嶅紑鍏冲垏鎹?:
 *   榛樿 = 寮€闃斾笘鐣? 瑙嗗彛 1280脳720 涔嬪杩樻湁 170px 缂撳啿甯? 鍑虹晫鍙彈鏌斿拰鐨? *          杈圭晫鍔? 娌℃湁绌垮睆鐬Щ 鈥斺€?楦熻兘椋炲嚭鐢婚潰銆佺寷绂戒細璺熶涪銆? *   鍙€?= 鐜潰 torus: 涓栫晫灏辨槸瑙嗗彛澶у皬, 鍥涘懆绌垮睆, 鎵€鏈夌浉瀵瑰悜閲忚蛋 minImage銆? *   涓ょ妯″紡涓嬪嚑浣曡繍绠楃粺涓€璧?wrapX/wrapY/minImageX/minImageY, 浜掍笉骞叉壈銆? *
 * 鎰熺煡: 鐚涚娌℃湁鍏ㄥ眬瑙嗛噹銆俻erceive() 鍙粺璁¤閲庡崐寰勫唴鐨勬楦?缃戞牸妗堕绛?+
 *       閫愬彧绮剧‘鍒よ窛)涓庢渶杩戠殑闆? 瑙嗛噹绌烘椂闈犳垚鍛樿蹇?freshMem)缁х画鎼滅储銆? *
 * 姣忓抚椤哄簭: 缃戞牸 -> 妞嬮笩鍔涙壂鎻?-> 杩佸緳 -> 妞嬮笩绉垎/琚崟椋?閫冮€?鍥存敾 -> 闆?->
 *           楣?Q-learning) -> 闅?鑳介噺杞崲) -> 鑷姩琛ュ厖 -> 楣伴毤浜掓敾 -> 娓叉煋銆? * ========================================================================== */

/* ------------------------------ 0. 涓栫晫涓庡嚑浣?------------------------------ */

const VIEW_W = 1280, VIEW_H = 720;   // 瑙嗗彛(鐢诲竷)灏哄 鈥斺€?鍙鐢诲竷/鎶曞奖, 涓?涓栫晫"鏃犲叧
// 銆愮 8 杞慨姝ｂ懃銆戜笘鐣屽昂瀵镐笌瑙嗗彛**瑙ｈ€?*: 楦熺殑娲诲姩鑼冨洿涓嶅啀鏄?瑙嗗彛 卤 缂撳啿甯?, 鑰屾槸鏁翠釜涓栫晫銆?// 杈圭晫涓嶆槸澧? 鏄竴鍦?鍘屾伓鍊?: 杩涘叆 BOUND_R 甯﹀唴灏卞紑濮嬭嚜涓昏浆鍚戣繙绂? 瓒婅繎瓒婂己(浜屾澧為暱),
// 鍥犳涓綋姘歌繙涓嶄細琚‖澶瑰湪杈逛笂(wrapX/wrapY 閲屽師鏉ョ殑 clamp 宸茬粡鍒犳帀)銆?const W = 3200, H = 2200;            // 涓栫晫灏哄(鈮?.5脳2.9 涓鍙?
const BOUND_R = 420;                 // 杈圭晫鍘屾伓鍗婂緞(杩涘叆杩欎釜甯﹀唴寮€濮嬭浆鍚?
const PAD_OPEN = 170;                // 缃戞牸棰濆杈硅窛(涓嶅啀浠ｈ〃涓栫晫杈圭晫)
const MAXN = 20000;               // 妞嬮笩鏁扮粍棰勫垎閰嶄笂闄?浠诲姟0 鍩哄噯瑕佽窇鍒?N=20000)
let   N = 2000;                   // 褰撳墠妞嬮笩鏁?const M = 60;                     // 闆佹暟(椤讳负鍋舵暟, V 褰㈠乏鍙宠噦瀵圭О)
let   PAD = PAD_OPEN;             // 褰撳墠缂撳啿甯?鐜潰妯″紡涓?0)
let   TORUS = false;              // false = 寮€闃斾笘鐣?杞竟鐣?, true = 鐜潰(绌垮睆)
let   GW = 1, GH = 1;             // 缃戞牸妗舵暟閲?
/* ------------------------------ 1. 鍙傛暟鍖?------------------------------ */

const TAU = Math.PI * 2;

// ---- 妞嬮笩: 鎷撴墤 boids ----
// G: 鏀剁揣楦熺兢 鈥斺€?鍑濊仛鍘嬭繃瀵归綈(COHESION 2.0 > ALIGNMENT 1.2), 鍏佽鏇磋繎韬綅
//    (SEP 20), 杞悜鏇存湁鍔?MAX_FORCE 0.15), 鎰熺煡/缃戞牸妗剁缉鍒?50銆侹 浠嶄负 7銆?// 绗?7 杞? 鍐嶆敹绱т袱妗?鈥斺€?鍒嗙鍗婂緞 20->11, 鎰熺煡/妗?50->36(鍊欓€夋暟涓嶄細鍥犲彉瀵嗚€岀垎鐐?, 
//    涓綋浣撶Н鍚屾缂╁皬(瑙?BODY 甯搁噺), 浜庢槸"楦熶笌楦熶箣闂?鐪嬭捣鏉ヨ繎浜嗕竴鍊嶃€?const PERCEPTION = 36.0;                 // 鍊欓€夋敹闆嗗崐寰?鍐嶄粠涓彇鏈€杩?K 鍙?
const PERCEPTION_R2 = PERCEPTION * PERCEPTION;
const CELL = PERCEPTION;                 // 缃戞牸妗惰竟闀?recomputeGridSize 鑷姩璺熼殢)
let   topoK = 7;                         // 鎷撴墤閭诲眳鏁?K(婊戞潌鍙皟, 涓婇檺 TOPO_MAX)
const TOPO_MAX = 16;
const SEP_R2 = 11.0 * 11.0;              // 鍒嗙瑙﹀彂鍗婂緞(绗?7 杞? 20 -> 14 -> 11)
const SEP_GAIN = 4.0;                    // 璺濈鍔犳潈鍒嗙: 瓒婅繎鎺ㄥ緱瓒婄嫚
const MAX_SPEED = 3.6;
const MAX_FORCE = 0.15;
const COHESION_W = 2.0, ALIGNMENT_W = 2.4;
const CENTROID_FORCE = 0.015;            // 鏋佸急璐ㄥ績寮曞姏, 闃叉案涔呯瑁?鏁ｅ緱澶紑鏃舵彁鍒?0.025)
const MIGRATE_FORCE = 0.06;              // 杩佸緳鍊惧悜, 鎶婄兢浣撴媺鎴愭祦鍔ㄩ甯?const REFRACT = 18;
const CONT_W = 2;
const RELAY_MIN = 0.15;
const ALERT_TRIG = 0.09;
const ALERT_FRAMES = 12;
const ANISO = 0.3;

/* ---- 绗?7 杞? 涓綋浣撶Н鍐嶆敹灏忎竴妗?2D 涓?WebGL 涓ゆ潯娓叉煋璺緞鍏辩敤鍚屼竴缁勬暟瀛? ----
 * drawArrow(x, y, vx, vy, 灏栫, 灏鹃暱, 缈煎睍); GL 閭ｈ竟鐢?glScene.shapes 鐨勫悓涓€缁勫€笺€?*/
const BODY_S = [1.6, 1.0, 1.0];          // 妞嬮笩(鍘?2.2 / 1.4 / 1.4)
const BODY_G = [2.1, 1.2, 1.3];          // 闆? (鍘?3.2 / 1.8 / 2.0)
const BODY_F = [4.8, 4.0, 2.6];          // 闅? (鍘?6.5 / 5.5 / 3.6)
const BODY_E = [5.5, 4.4, 3.0];          // 楣? (鍘?7.5 / 6.0 / 4.2)
const BOUND_FORCE = 0.30;                // 寮€闃斾笘鐣岀殑鏌旀€ц竟鐣屽姏

// ---- 鎹曢涓庤鍒?----
// F: 涓綋涓庡垽瀹氫竴璧风缉灏?鈥斺€?瑙嗚灏哄, 鍒ゅ畾鍦堝悓姝ユ敹(9/12 鑰岄潪 12/15)
const EAT_R2_S = 9 * 9;                  // 妞嬮笩琚悆鍗婂緞
const EAT_R2_G = 12 * 12;                // 闆佽鍚冨崐寰?const SCORE_STARLING = 1, SCORE_GOOSE = 100;

// ---- 閫冮€?楦熷鐚涚) ----
const FLEE_R2 = 110.0 * 110.0;
const FLEE_FORCE = 0.45, FLEE_W = 2.2;

// ---- 闅? 鑳介噺杞崲 + 鎷︽埅浣?----
const CIRCLE_SPEED = 5.0;                // 鐩樻棆閫熷害
const DASH_SPEED = 8.5;                  // 鍐插埡閫熷害(鐖嗗彂鍨?
const REST_SPEED = 7.5;                  // 璁句紡鏂硅刀璺€熷害(蹇簬鐩樻棆, 淇濊瘉璧跺埌)
const CIRCLE_FRAMES = 110;               // 涓ゆ鍐插埡闂磋嚦灏戠洏鏃嬬殑甯ф暟
const CIRCLE_TURN = 0.07;                // 鐩樻棆鏃舵瘡甯ц浆鍚戣
const DASH_EXTRA = 180.0;                // 鍐插埡鏃堕暱 = (璺濈+浣欓噺)/閫熷害
const DASH_MAX_DIST = 500;               // 鍐插埡璺濈涓婇檺(闃叉妯┛鏁翠釜涓栫晫)
const DASH_MAX_ANGLE = Math.PI / 3;      // 鍐插埡鏂瑰悜涓庡綋鍓嶈埅鍚戞渶澶уす瑙?60掳
/* ---- task-3: 鍐插埡鐬勫噯涓庝刊鍐叉斁瀹?-------------------------------------------
 * 瀹炴祴(5000 甯?/ N=2000 / 鏃犺ˉ鍏?/ 鍏宠ˉ鍏?: 闅煎啿鍒?57 娆? 鍏朵腑 dashEats=0 鐨?54 娆?96%) 鈥斺€? * 鍐插埡鍑犱箮鎶撲笉鍒颁笢瑗? 璐﹂潰"姣忔鍐插埡鎹曡幏 1.9 鍙?鍏跺疄鍏ㄦ槸宸¤埅鏃舵挒杩涢笩浜戣鍔ㄥ悆鍒扮殑銆? * 鍘熷洜: D 閿佸畾鍚?鍐插埡鏈熼棿鍙悆寰楀埌琚攣瀹氶偅涓€鍙?, 鑰岀瀯鐨勬槸**鎹炲嫼涓績鐨勫綋鍓?*浣嶇疆:
 * 妞嬮笩 3.6px/甯ч€冦€侀毤 8.5px/甯ц拷, 鍒拌揪瑕佸嚑鍗佸抚, 閿佸畾閭ｅ彧鏃╄窇鍑轰竴涓韩浣嶄簡銆? * 鎵€浠ユ寜"鍒拌揪鏃堕棿 脳 鐚庣墿閫熷害"鍓嶇疆鐬勫噯(绾瘮渚嬪寮曠殑涓€闃惰В), 钀界┖鍐嶉€€鍥炴崬鍕轰腑蹇冦€?*/
const DASH_LEAD = 1.0;                   // 鍓嶇疆鐬勫噯绯绘暟(1 = 鍏ㄩ鍓嶇疆; 0 = 鐬勭寧鐗╁綋鍓嶄綅缃?
const DASH_MAX_LEAD_T = 45;              // 鍓嶇疆鏃堕棿涓婇檺(甯?: 闃茶秴杩滅洰鏍囪鍓嶇疆鍒扮璋变綅缃?const DASH_ENGAGE_R = 300;               // 鍑烘墜璺濈涓婇檺: 閿佸畾鐩爣姘村钩璺濈瓒呰繃瀹冨氨涓嶅啿(鍏堢洏鏃嬮€艰繎)
const DASH_MAX_ANGLE_V = 80 * Math.PI / 180; // 涓夌淮鍒ゅ畾鐨勪刊鍐叉斁瀹戒笂闄? 鐩爣鍦ㄤ笅鏂规椂鍏佽鏇撮櫋鐨勫す瑙?/* ---- task-3: 鍐插埡鍚庣殑鎭㈠鏈?鑺傚) ----------------------------------------
 * 鍘熷啓娉曟瘡娆″啿鍒虹粨鏉熼兘 f.circleT = CIRCLE_FRAMES = 110 瀹氬€? 浜庢槸"鍐插埡鈫掔洏鏃嬧啋鍐嶅啿鍒?
 * 鎴愪簡鍥哄畾鑺傚緥(瀹炴祴闂撮殧 CV=0.32 涓?55 涓棿闅旈噷 44 涓尋鍦?100~180 甯?銆傝繖閲岀粰鎭㈠鏈? * 鍔?绉佹湁 LCG 鎶栧姩 + 鐤插姵椤?: 涓嶇鍏ㄥ眬 Math.random 娴?鍚﹀垯瀹堟亽绾垮搱甯屼細鏁翠綋婕傜Щ),
 * 鑺傚緥鍙堜笉鍐嶆槸涓€涓父鏁般€?*/
const FALCON_REST_LO = 0.70, FALCON_REST_HI = 1.30;  // 鎭㈠鏈熼殢鏈哄€嶆暟鍖洪棿(脳 CIRCLE_FRAMES)
const FALCON_REST_FATIGUE = 60;          // 鐤插姵椤? 鍓╀綑鑳介噺瓒婁綆鎭㈠瓒婁箙(甯? 绾挎€?
const ENERGY_MAX = 100;
const DASH_DRAIN = 0.55;
const ACTIVE_REGEN = 0.40;
const REST_REGEN = 0.90;
const ENERGY_LOW = 25;                   // 浣庝簬姝ゅ€奸€€鍑鸿拷鐚? 浜ゆ
const DASH_MIN = 35;                     // 鍙戣捣鍐插埡鎵€闇€鏈€浣庤兘閲?const DOUBLE_TEAM_E = 85;                // 璁句紡鏂硅兘閲忛珮浜庢涓旇窛瀵嗛泦鐐硅繎 -> 鍋跺彂鍙屾墦
const INTERCEPT_GAIN = 0.35;             // 鍚戞嫤鎴綅闈犳嫝鐨勫姏搴?杞悜涓婇檺)
const INTERCEPT_MIN = 90;                // 璺濇嫤鎴綅灏忎簬姝ゅ€煎垯鍘熷湴缁曞湀绛夊緟
const INTERCEPT_AHEAD = 0.55;            // 鎷︽埅浣?= 璐ㄥ績娌?杩滅杩界寧鏂?鏂瑰悜澶栨帹鐨勬瘮渚?const VIEW_FALCON = 420.0;
const VIEW_FALCON_R2 = VIEW_FALCON * VIEW_FALCON;

// ---- 楣? 浣撴牸 + Q-learning ----
const EAGLE_CRUISE = 5.8;                // 宸¤埅姣旈毤蹇? 鑰愬姏鍨? 闈犻暱璺濈杩界寧鑰楁闆?const EAGLE_DASH = 7.2;                  // 鍐插埡姣旈毤寮?闅?8.5)
const EAGLE_DASH_FRAMES = 18;
const EAGLE_DASH_CD = 60;
const EAGLE_DASH_TRIGGER = 140;
const AMBUSH_LEAD = 45;                  // 浼忓嚮鐐规部缇や綋琛岃繘鏂瑰悜澶栨帹鐨勫抚鏁?// 鍐崇瓥绾厓: 閫夊畾鐨勫姩浣滀繚鎸佽繖涔堝甯у啀閲嶆娊(1 = 閫愬抚閲嶆娊, 涓庡師琛屼负瀹屽叏涓€鑷?銆?// 璇曡繃 =20: 鑳借"杩介泚"杩欑瑕佸嚑鐧惧抚鐨勫姩浣滅湡姝ｈ鎵ц, 涓埆绉嶅瓙涓?Q 琛ㄨ兘鎷夊紑宸窛
// (渚嬪 闆佽繎琛?11.5 vs 3.7), 浣?4 绮掔瀛愮殑閫氳繃鐜囨病鏈夋敼鍠?2/4 -> 2/4), 鍥犱负
// 閫愬抚鎺㈢储鍣０铏藉, 鍗磋ˉ鍋夸簡鍐崇瓥鏁? 榛樿鍥炲埌 1, 鎯宠瘯灏辨敼鎴?20銆?const EAGLE_DECIDE_EVERY = 1;
const VIEW_EAGLE = 520.0;                // 楣伴寰楅珮鐪嬪緱杩?const VIEW_EAGLE_R2 = VIEW_EAGLE * VIEW_EAGLE;
const Q_ALPHA = 0.1, Q_GAMMA = 0.995;    // 瀛︿範鐜?/ 鎶樻墸鍥犲瓙(姣忓抚)
// 娉ㄦ剰 Q_GAMMA 鏄?姣忓抚"鎶樻墸: 杩戒竴娆￠泚瑕佸嚑鐧惧抚, 鎵€浠ュ繀椤绘帴杩?1(0.995 -> 鍗婅“鏈?// 绾?140 甯?銆傚師鐗堢敤 0.95(鍗婅“鏈?14 甯?, 淇＄敤鍦ㄥ嚑姝ュ唴灏辫“鍑忓厜浜? 闀跨▼杩界寧
// 鏍规湰瀛︿笉鍑烘潵, Q 琛ㄩ€€鍖栨垚鍣０ 鈥斺€?杩欐槸鏁村悎鏃朵慨鎺夌殑涓€涓湡闂銆?const EPS0 = 0.3, EPS_MIN = 0.08, EPS_DECAY = 0.9995;
// 鐘舵€?= (鐚庣墿绫诲瀷 0妞嬮笩/1闆? 脳 (璺濈妗?0杩?1涓?2杩? = 6 鎬? 鍔?1 涓?瑙嗛噹鍏ㄧ┖"鎬?const STATE_NONE = 6;
const N_STATES = 7, N_ACTIONS = 4;
// E: 鍔ㄤ綔琛ㄦ墿鍒?4 鈥斺€?0杩芥楦熷瘑闆嗗 1杩芥渶杩戦泚 2娓歌崱浼忓嚮 3鏀诲嚮绔炰簤鑰?鏈€杩戠殑闅?
//    Q 绱㈠紩鐢?state*N_ACTIONS+a, 鍒囧繉鍐嶅啓瀛楅潰閲?*3銆?
// ---- 闆佺兢: 棰嗛槦鍒?V 缂栭槦 ----
const MAX_SPEED_G = 4.4;                 // 闆佹瘮妞嬮笩蹇? 闈犻€熷害 + 缂栭槦 + 棰勮鑷繚
const LEADER_SPEED = 4.0;
const SLOT_SPACING = 15;
const SLOT_FORCE = 0.14;
const FORMATION_BREAK = 150.0;           // 鐚涚鎺ヨ繎鍒版璺濈, 缂栭槦瑙ｆ暎閫冮€?const GSEP_R2 = 10 * 10;

/* ---- 鏂板鏈哄埗甯搁噺(鏈 A~E) ----------------------------------------
 * 鎯╃綒/浠ｈ阿銆佸洿鏀汇€佽糠鎯戙€佷簰鏀诲洓濂楁満鍒跺叡鐢? 鍙墸 score, 涓嶅姩 kills/diet銆?*/
// A: 绌哄啿鍒烘墸鍒?鈥斺€?鍐插埡涓€涓嬩粈涔堜篃娌″悆鍒板氨缃氬垎(闅奸噸銆侀拱杞?
const MISS_PENALTY_FALCON = 4;
const MISS_PENALTY_EAGLE = 2;            // 瀛︿範琚柊鏈哄埗娣规病 -> 鎸夎鏍煎缓璁粠 3 闄嶅埌 2
// B: 浠ｈ阿鎴愭湰(姣忓抚) 鈥斺€?鐩樻棆/鍐插埡/楣板贰鑸兘瑕佺儳鑳介噺, 璁?涓嶅姩鐨勪紡鍑?涔熸湁浠ｄ环
const METAB_CIRCLE = 0.002;
const METAB_DASH = 0.010;
const METAB_EAGLE = 0.003;
// C: 鍥存敾(mobbing) 鈥斺€?涓€閮ㄥ垎妞嬮笩鏄?鍥存敾鑰?, 闈犺繎鐚涚灏辩粨鎴愰獨鎵扮幆
const MOB_FRACTION = 0.08;               // 妞嬮笩閲屽洿鏀昏€呯殑姣斾緥
const MOB_R = 170;                       // 鍥存敾鑰呯殑鍝嶅簲鍗婂緞
const MOB_HARASS = 55;                   // 楠氭壈鐜崐寰? 鐜閫艰繎銆佺幆鍐呮帹寮€
const MOB_MAX = 0.05;                    // 楠氭壈杞悜鍔涗笂闄?const MOB_DRAIN_PER = 0.04;              // 姣忓彧鍥存敾鑰呰鍐插埡鑳借€楀鍔犵殑姣斾緥
const MOB_PENALTY_N = 25;                // 鍚屼竴甯у唴鍥存敾鑰呮暟 >= 姝ゅ€?-> 鍐插埡琚‖鐢熺敓鎵撴柇
const MOB_SLOW_FALCON = 0.6;             // 闈炲啿鍒洪€熷害涓嬮檺(闅?
const MOB_SLOW_EAGLE = 0.7;              // 闈炲啿鍒洪€熷害涓嬮檺(楣?
// D: 杩锋儜鏁堝簲 鈥斺€?鍐插埡閿佸畾鍗曚釜鐩爣, 鍐插埡鏈熼棿鍙悆寰楀埌"琚攣瀹氶偅涓€鍙?
const DASH_LOCK = true;
// E: 楣伴毤浜掓敾(椹遍€愬埗) 鈥斺€?闈犲お杩戝氨鍒嗚儨璐? 杈撶殑鐪╂檿/琚嚮閫€/鎵ｅ垎骞惰鎶㈠垎
const CLASH_R = 34;                      // 瑙﹀彂浜掓敾鐨勮窛绂?const CLASH_STUN = 90;                   // 璐ユ柟鐪╂檿甯ф暟
const CLASH_KNOCK = 11;                  // 璐ユ柟琚嚮閫€鐨勮窛绂?const CLASH_COST = 10;                   // 璐ユ柟鎵ｅ垎
const STEAL_FRAC = 0.2;                  // 鑳滄柟鎶㈣蛋璐ユ柟鍓╀綑鍒嗘暟鐨勬瘮渚?const CLASH_CD = 45;                     // 鍚屼竴瀵圭寷绂界殑浜掓敾鍐峰嵈(鍚﹀垯浼氶€愬抚杩炵幆鎵ｅ垎)
const RIVAL_R = 150;                     // 闅煎惎鍔?椹遍€愬啿鍒?鐨勫鎵嬭窛绂?
/* ---- 绗?4 杞柊澧炲父閲?--------------------------------------------------
 * 绗竴閮ㄥ垎: 鐚涚閲囨牱鐩爣鑾峰彇(鏋佸潗鏍囨崬鍕? 路 绗簩閮ㄥ垎: 闆佺兢涓績鍖栭噸鏋? * 绗笁閮ㄥ垎: 闅肩殑 (1+1)-ES 绛栫暐杩涘寲 路 绗洓閮ㄥ垎: 闆佸€熺敤妞嬮笩缃戠殑鎯婇棰勮 */

// 1. 閲囨牱鐩爣鑾峰彇: 浠ョ寷绂戒负鍘熺偣鐨勬瀬鍧愭爣鍊欓€夌偣, 缁熻姣忎釜鐐?鎹炲嫼"閲岀殑楦熸暟
const SAMPLE_RADII = [80, 160, 240, 320, 400];   // 閲囨牱鐜崐寰?const SAMPLE_ANGLES = 16;                        // 姣忕幆瑙掑害鏁?鍏?5脳16 = 80 涓€欓€?
const SCOOP_R = 60;                              // 鎹炲嫼鍗婂緞: 鍊欓€夌偣鍛ㄥ洿澶氬皯 px 鍐呯殑楦熻璁″叆
const SCOOP_R2 = SCOOP_R * SCOOP_R;
const LOCK_R = 40;                               // 閿佸畾鍗婂緞: 鍐插埡涓績杩欎箞澶?px 鍐呮渶杩戠殑楦熻閿?const LOCK_R2 = LOCK_R * LOCK_R;
const DIR_LAG = 0.3;                             // 鏂瑰悜婊炲悗: score *= 1 + DIR_LAG路cos(鍊欓€夋柟鍚? 褰撳墠鑸悜)
const N_CAND = SAMPLE_RADII.length * SAMPLE_ANGLES;

// 2. 闆佺兢涓績鍖栭噸鏋?const LEADER_SENSE_R = 400;                      // 棰嗛槦鎰熺煡鐚涚鐨勫崐寰?const LEADER_MAX_TURN = 0.04;                    // 棰嗛槦杞悜闄愰€?寮у害/甯?
const ESCAPE_HUSTLE = 1.15;                      // 濞佽儊 250px 鍐呴闃熼€熷害鍊嶇巼
const LEADER_PANIC_R = 250;
const GOOSE_MAX_TURN = 0.06;                     // 姣忓彧闆佺殑杞悜闄愰€?寮у害/甯? 鍘嬪潯鎯€?
const ROTATE_FRAMES = 1200;                      // 杞€奸闃熷懆鏈?20 绉?
const JUVENILE_FRAC = 0.25;                      // 骞奸泚姣斾緥(鍥哄畾鍗犲唴閬撴Ы浣?
const JUVENILE_DEBUFF_FRAMES = 1800;             // 骞奸泚姝讳骸鍚庣殑娌抚鏈?const DEBUFF_FACTOR = 0.7;                       // 娌抚鏈熷唴鍏ㄤ綋褰掍綅鍔涘€嶇巼
const CONE_R = 180;                              // 濞佹厬閿ュ崐寰?V 灏栦负椤剁偣)
const CONE_HALF_ANGLE = Math.PI / 3;             // 濞佹厬閿ュ崐瑙?60掳(姝ｉ潰 120掳)
const CONE_COS = Math.cos(CONE_HALF_ANGLE);
const CONE_SCORE_FACTOR = 0.25;                  // 閿ュ唴鍊欓€夌偣鎵撳垎涔橀」(閫夌洰鏍囪嚜宸辩粫寮€姝ｉ潰)
const CONE_FALCON_DASH_MULT = 2;                 // 閿ュ唴闅肩殑鍐插埡鑳借€楀€嶇巼
const CONE_EAGLE_DRAIN = 0.01;                   // 閿ュ唴楣版瘡甯?pending 澶辫
const DISARRAY_FRAMES = 90;                      // 鏂╅鍚庣殑娣蜂贡鏈?妲戒綅鍔涘叧闂?

// 3. 闅肩殑 (1+1)-ES 鍦ㄧ嚎杩涘寲
const ES_EVAL_FRAMES = 3600;                     // 涓€涓瘎浼版湡 60 绉?閫傚簲搴﹀櫔澹板ぇ, 鏈熼暱閰嶅姣旇緝)
const ES_SIGMA = 0.1;                            // 鍊欓€夊弬鏁?= 褰撳墠 + N(0, 蟽), 鎴柇鍒?[0,1]
const ES_MISS_WEIGHT = 2;                        // 閫傚簲搴﹂噷钀界┖缃氭鐨勬潈閲?const ES_METAB_WEIGHT = 5;                       // 閫傚簲搴﹂噷浠ｈ阿鎴愭湰鐨勬潈閲?const P_DASH_MIN = [20, 60, 35];                 // p1 鍑烘墜鑳介噺闃堝€?[涓嬬晫, 涓婄晫, 榛樿]
const P_ENERGY_LOW = [10, 40, 25];               // p2 浜ゆ鑳介噺闃堝€?const P_DOUBLE_TEAM = [60, 95, 85];              // p3 鍙屾墦鑳介噺闃堝€?const P_INTERCEPT = [0.3, 0.8, 0.55];            // p4 鎷︽埅浣嶅鎺ㄦ瘮渚?const P_MOB_TOL = [0, 2, 1.0];                   // p5 mob 瀹瑰繊(涔樺湪 DASH_DRAIN 鐨?mob 椤逛笂)
const ES_NP = 5;                                 // 鍙涔犲弬鏁颁釜鏁?p6 绾挎€у啿鍒虹瓥鐣ョ暀浣滄墿灞曚綅, 瑙佷氦鎺ヨ鏄?

// 4. 闆佸€熺敤妞嬮笩缃戠殑鎯婇棰勮
const PV_ALERT_COS = 0.5;                        // 鎯婇鍒ゆ嵁: 鐩搁偦涓ゅ抚閫熷害澶硅 > 60掳(cos<0.5)
const ALERT_R = 140;                             // 闆佹煡鎯婇妞嬮笩鐨勫崐寰?const ALERT_R2 = ALERT_R * ALERT_R;
const ALERT_N = 3;                               // 鍗婂緞鍐呮儕椋炴楦?>= 3 -> 瑙嗗悓鐚涚閫艰繎
const ALERT_FALSE_R = 400;                       // 鍒ゅ畾"璇姤"鐨勫崐寰?鏈€杩戠寷绂芥瘮杩欒繕杩?

// ---- 鎰熺煡璁板繂 / 鑷姩琛ュ厖 / 鎷栧熬 ----
/* ---- 绗?8 杞? 涓夌淮鍖?+ 閲嶅姏 ----
 * 鏋舵瀯: xy 淇濇寔鐜版湁浜ら敊鏁扮粍(P/V/ACC/PV 姣忓彧 2 涓?float)涓€琛屼笉鍔?鈥斺€?缃戞牸/perceive/
 * WebGPU 璁＄畻/2D 淇/golden 鍝堝笇鍏ㄩ儴鍘熸牱淇濈暀; z 杞寸嫭绔嬫暟缁?Z/VZ), 閲嶅姏涓庡畾楂樺脊绨? * 鍙綔鐢ㄤ簬 z銆?D 淇(GRAV_ON 鍏虫帀鏃?涓庢棫鐗堥€愪綅涓€鑷? 3D 鍙槸娓叉煋+z 鍔ㄥ姏瀛︾殑澧為噺銆?*/
const Z_INIT = 170;                    // 鍒濆椋炶楂樺害
const Z_SPREAD = 150;                  // 鍒濆楂樺害鏁ｅ竷(浜戝洟鍘氬害; 绗?8 杞皟澶?-> Z 鍙樺寲鏇存槑鏄?
const G_GRAV = 0.060;                  // 閲嶅姏 px/甯?妞嬮笩/闆佺敱瀹氶珮寮圭哀瀵规姉; 鐚涚淇啿鍚冪孩鍒?
const ALT_SPRING = 0.011;              // 瀹氶珮寮圭哀: 鏈濅釜浜洪琛屽眰鐨勫洖澶嶅姏, 涓庨噸鍔涘钩琛?-> 鎮诞浜戝洟
const ALT_DAMP = 0.90;                 // 鍨傚悜闃诲凹(绗?8 杞慨姝?: 娌℃湁瀹?vz 浼氭棤闃诲凹鎸崱 -> 涓婁笅娉㈠姩
const ZT_SPREAD_K = 0.45;              // 涓汉椋炶灞傛暎甯?= Z_SPREAD 脳 璇ョ郴鏁?浜戝洟鍘氬害闈犲畠姘镐箙淇濈暀)
const FALCON_LAYER_OFF = 110;          // 闅煎贰鑸椂楂樹簬楦熺兢鍧囬珮澶氬皯(淇啿鏃舵墠涓嬪埌鐚庣墿灞?
/* ---- task-3: 闅肩殑宸¤埅/杩涚寧楂樺害绛栫暐 ---------------------------------------
 * 鍘熷啓娉?f.targetZ = pc.lockZ + 110路clamp((dPrey-200)/300) 涓庣揣闅忓叾鍚庣殑"鍘嬫満澶?浜掍负鍙嶅彿鍛戒护:
 * 鍙楂樿繃 lockZ+40, stoopT 灏?*姣忓抚閮借閲嶇疆鎴?10**(鍘嬫満澶存案涓嶇粨鏉?, 浜庢槸涓€璺刊鍐插埌 lockZ;
 * 钀借繘 40px 鍐呭悗 stoopT 鎵嶈“鍑? targetZ 鍙堣鐖洖 lockZ+110 鈥斺€?褰㈡垚 30 甯х骇鐨勪笂涓嬫瀬闄愮幆
 * (瀹炴祴: 宸¤埅 |螖z|/甯?0.80銆乿z 鍙嶅悜 64.5 娆?鍗冨抚銆亃-楦熺兢鍧囬珮鐨勬柟宸?1207)銆? * 淇硶: 鈶?鎶?瑕佸幓鐨勫眰"鍋氭垚涓€闃朵綆閫? lockZ 鎶栧姩涓庡眰闂磋烦鍙樿鏃堕棿甯告暟鍚告敹;
 *       鈶?淇啿鐩稿彧鍦?纭疄姣旂洰鏍囧眰楂樺嚭 FALCON_STOOP_DZ"鏃剁偣涓€娆＄伀, 涓嶅啀閫愬抚缁湡銆?*/
const FALCON_HUNT_R = 200;             // 姘村钩璺濈灏忎簬姝ゅ€?-> 灞傚樊寮€濮嬭“鍑?鍥炲埌鐚庣墿灞?
const FALCON_LAYER_RAMP = 300;         // 灞傚樊浠?0 娑ㄦ弧鎵€闇€鐨勯澶栨按骞宠窛绂?200 -> 500px)
const FALCON_ALT_SLEW = 0.06;          // 鐩爣灞備竴闃朵綆閫氱郴鏁?鏃堕棿甯告暟 鈮?17 甯?
const FALCON_STOOP_DZ = 55;            // 楂樹簬鐩爣灞傝繖涔堝 -> 瑙﹀彂涓€娆′刊鍐茬浉(鍘嬫満澶?10 甯?
const FALCON_ALT_LEAD = 12;            // 鍨傚悜鎺у埗鍣ㄧ殑鍓嶇灮甯ф暟(鐢?z + LEAD路vz 鍋氳鎺ч噺, 娑堟帀娆犻樆灏兼尟鑽?
const EAGLE_LAYER_OFF = 80;            // 楣板贰鑸┖灞傚樊
// 銆愮 8 杞慨姝ｂ憿銆戝悆鍒ゆ槸鍚︾敤 3D 鐞冦€傞粯璁?false(鍙寜姘村钩闈㈠垽瀹?:
// 2D 鐗堟槸闈?姘村钩闈笂鐨勯珮瀵嗗害"鎾為笩鐨?鍐插埡鎵繃 9px 绠￠亾, 瀵嗛泦楦熺兢閲屽繀涓?;
// 浜戝洟涓€鍘?250px, 鍚屾牱绠￠亾閲岀殑楦熷氨灏戠害 4 鍊?鈥斺€?瀹炴祴鎬绘崟鑾?77 -> 19, 姣斾緥姝ｅソ瀵逛笂銆?// 缃?true 鎭㈠"3D 鐞?(鏇寸湡瀹? 鎹曢鐜囨帀鍒扮害 1/4)銆傞潰鏉垮嬀閫夋垨 SIM.setEat3D(on) 鍙垏銆?let   EAT_3D = false;
const Z_CEIL = Z_INIT + Z_SPREAD * 1.4;   // 楦熻兘涓诲姩鐖埌鐨勯珮搴︿笂闄?涓汉椋炶灞傜殑娲诲姩鑼冨洿)
const FLOOR_Z = 0;                     // 鍦伴潰
const FLOOR_PUSH = 0.35;               // 杩戝湴鎺ㄥ崌鍔?娲婚笩涓嶈惤鍦? 灏镐綋闄ゅ)
const CLIMB_RATE = 0.14, DIVE_RATE = 0.26;   // 鐚涚鍨傜洿閫熺巼闄愬箙(鐖崌鎱?淇啿蹇?
const DIVE_BOOST = 0.16;               // 淇啿绾㈠埄: 鍐插埡閫熷害 += max(0,-vz)路DIVE_BOOST(娓搁毤 stoop)
const GROUND_MARGIN = 30;              // 鐚涚杩戝湴鎷夎捣楂樺害(涓嶈淇啿鎾炲湴)
const GOOSE_LAYER = 280;               // 闆佺殑缁濆绋冲畾灞?z) 鈥斺€?鏄庢樉楂樹簬妞嬮笩浜戝洟(鈮圸_INIT)
// 绗?8 杞皟浼? 涓夌淮閲屾寜涓栫晫鍗曚綅鐢?1.6px 鐨勯笩鍦?950px 瑙嗚窛涓嬪彧鏈夐浂鐐瑰嚑鍍忕礌 -> 鐪嬩笉瑙併€?// 杩欓噷鎶婁笁缁翠綋绉斁澶? 骞剁粰"杩滃涓嶅啀鍙樺皬"鐨勬渶灏忓儚绱犱繚鎶? 鍙奖鍝嶆覆鏌? 涓嶅姩鐗╃悊銆?let   SIZE3D_MUL = 4.0;                // 涓夌淮浣撶Н鍊嶆暟(SIM.setSize3D 鍙皟)
const SIZE3D_MINPX = 1.15;             // 杩滃鏈€灏忓儚绱犱繚鎶ら槇鍊?// 绗?8 杞箣涓? 涓夌淮楦熸嫋灏?閫熷害鎷栧熬鏉? 涓嶆槸鍘嗗彶鐐规姌绾?鈥斺€?鏇寸渷涓旇浆鍚戜笉绯?
let   TRAIL3_ON = true;                // 寮€鍏?闈㈡澘鍕鹃€?/ SIM.setTrail3)
let   TRAIL3_LEN = 6.5;                // 鎷栧熬闀垮害 = 閫熷害 脳 璇ョ郴鏁?甯?
let   TRAIL3_W = 0.5;                  // 鎷栧熬妯悜瀹藉害鐩稿浣撳瀷
let   TRAIL3_ALPHA = 0.42;             // 澶撮儴閫忔槑搴?灏鹃儴娓愰殣鍒?0)
let   GRAV_ON = true;                  // 閲嶅姏鎬诲紑鍏?闈㈡澘鍕鹃€? 鍏虫帀鍗抽€€鍖栦负鏃?2D 琛屼负)
try { if (/[?&]grav=0/.test(window.location.search)) GRAV_ON = false; } catch (e) { /* headless */ }   // 瀹堟亽绾? 蹇呴』鍦ㄩ娆″垵濮嬪寲鍓嶅氨鑳藉叧閲嶅姏
let   zMeanLive = Z_INIT;              // 缇や綋瀹炴椂鍧囬珮(鐩告満璺熻釜鐢?
let   zLowLive = FLOOR_Z, zHighLive = Z_INIT + Z_SPREAD;   // 楂樺害鑼冨洿(涓夌淮浜害鏄犲皠鐢?

const MEM_FRAMES = 300;                  // 鐪嬩笉瑙佺寧鐗╂椂, 璁板繂鐐规湁鏁堟湡(甯?
const REFILL_RATIO = 0.35;               // 妞嬮笩瀛樻椿浣庝簬姝ゆ瘮渚?-> 琛ヤ竴娉?const REFILL_G_RATIO = 0.5;              // 闆佸瓨娲讳綆浜庢姣斾緥 -> 琛ュ洖缂栭槦
const REFILL_CHECK = 300;                // 姣忓灏戝抚妫€鏌ヤ竴娆?const TRAIL_LEN = 50;

/* ------------------------------ 2. 宸ュ叿鍑芥暟 ------------------------------ */

const clamp = (x, lo, hi) => x < lo ? lo : (x > hi ? hi : x);

// 鐜潰鏈€灏忓儚: 寮€闃斾笘鐣岄噷鏄亽绛夋槧灏? 鐜潰鏃舵妸鐩稿鍧愭爣鎶樺洖 [-W/2, W/2]
const minImageX = d => TORUS ? d - W * Math.round(d / W) : d;
const minImageY = d => TORUS ? d - H * Math.round(d / H) : d;
  // 浣嶇疆鏀舵嫝: 鐜潰鍙栨ā; 寮€闃斾笘鐣?*涓嶅啀澶瑰彇** 鈥斺€?杈圭晫鐢?applyBoundary 鐨勫帉鎭跺姏澶勭悊,
  // 浣嶇疆鏈韩淇濇寔鑷敱(缃戞牸绱㈠紩鍦?cellOf 閲屽す鍙? 瓒婄晫涔熶笉浼氳秺鏁扮粍)銆?  const wrapX = x => TORUS ? ((x % W) + W) % W : x;
  const wrapY = y => TORUS ? ((y % H) + H) % H : y;

const angDiff = (a, b) => {
  let d = (a - b + Math.PI) % TAU;
  if (d < 0) d += TAU;
  return d - Math.PI;
};

// Box-Muller 楂樻柉閲囨牱, 璁╁垵濮嬬兢浣撴垚鍥㈣€岄潪鍧囧寑鎾掑竷
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

function recomputeGridSize() {
  GW = Math.max(1, Math.ceil((W + 2 * PAD) / CELL));
  GH = Math.max(1, Math.ceil((H + 2 * PAD) / CELL));
  allocGrid();
}

/* 銆愮 8 杞慨姝ｂ懃銆戣竟鐣?= 鍘屾伓鍊?涓嶆槸澧?:
 *   鈶?杩涘叆 BOUND_R 甯﹀唴 -> 鍔犱竴涓寚鍚戜笘鐣屽唴閮ㄧ殑鍔? 澶у皬闅?(1-d/R)虏 澧為暱(瓒婅繎瓒婂己);
 *   鈶?鍚屾椂鍓婃帀"鏈濆"鐨勯€熷害鍒嗛噺, 鍏嶅緱甯︾潃鎯€у啿鍑哄幓(鍙墛鏈濆閭ｉ儴鍒? 涓嶇妯悜);
 *   鈶?姝ｅ湪鍐插埡(dashT>0)鐨勭寷绂介€熷害鏄攣瀹氱殑, 闈?鈶?杞笉鍔?-> 杩涘叆甯﹀唴杈冩繁澶勫氨涓诲姩鏀跺娍(dashT=0);
 *   鈶?鏋佽繙澶勭殑鏁板€煎厹搴?姝ｅ父姘镐笉瑙﹀彂, 瑙﹀彂鍗宠鍏?boundClamp 渚涢獙鏀舵鏌?銆? * 杩欐牱鎵€鏈変釜浣撻兘鏄?鑷繁杞紑", 涓嶄細鍑虹幇璐磋竟/鎾炶竟銆?*/
let boundClamp = 0, boundPeak = 0, boundMinEdge = Infinity;
function applyBoundary(o, k) {
  if (TORUS) return;
  const dl = o.x, dr = W - o.x, dt = o.y, db = H - o.y;
  let nX = 0, nY = 0, pen = 0;
  if (dl < BOUND_R) { const u = 1 - dl / BOUND_R; nX += u; if (u > pen) pen = u; }
  if (dr < BOUND_R) { const u = 1 - dr / BOUND_R; nX -= u; if (u > pen) pen = u; }
  if (dt < BOUND_R) { const u = 1 - dt / BOUND_R; nY += u; if (u > pen) pen = u; }
  if (db < BOUND_R) { const u = 1 - db / BOUND_R; nY -= u; if (u > pen) pen = u; }
  const e = Math.min(dl, dr, dt, db);
  if (e < boundMinEdge) boundMinEdge = e;
  if (pen > 0) {
    if (pen > boundPeak) boundPeak = pen;
    const m = Math.hypot(nX, nY) || 1; nX /= m; nY /= m;
    const F = BOUND_FORCE * k * pen * pen * 9;
    o.vx += nX * F; o.vy += nY * F;
    const vOut = o.vx * nX + o.vy * nY;
    if (vOut < 0) { const cut = -vOut * 0.35 * pen; o.vx += nX * cut; o.vy += nY * cut; }
    if (o.dashT > 0 && pen > 0.5) o.dashT = 0;      // 鍐插埡涓笉纭浆, 鐩存帴鏀跺娍
  }
  // 鏁板€煎厹搴? 鍙湁鐪熺殑璺戝埌涓栫晫澶?2脳BOUND_R 鎵嶅姩鎵?姝ｅ父姘镐笉鍙戠敓)
  if (o.x < -BOUND_R * 2 || o.x > W + BOUND_R * 2 || o.y < -BOUND_R * 2 || o.y > H + BOUND_R * 2) {
    o.x = clamp(o.x, -BOUND_R * 2, W + BOUND_R * 2); o.y = clamp(o.y, -BOUND_R * 2, H + BOUND_R * 2);
    boundClamp++;
  }
}
// 鍚屼笂, 浣嗙洿鎺ュ湪"鏁扮粍缁撴瀯(AoS 鐨?SoA 鐗?"涓婁綔鐢? 妞嬮笩/闆佺敤鍔涚疮鍔?function boundAccel(x, y, vx, vy, dashT) {
  if (TORUS) return null;
  const dl = x, dr = W - x, dt = y, db = H - y;
  let nX = 0, nY = 0, pen = 0;
  if (dl < BOUND_R) { const u = 1 - dl / BOUND_R; nX += u; if (u > pen) pen = u; }
  if (dr < BOUND_R) { const u = 1 - dr / BOUND_R; nX -= u; if (u > pen) pen = u; }
  if (dt < BOUND_R) { const u = 1 - dt / BOUND_R; nY += u; if (u > pen) pen = u; }
  if (db < BOUND_R) { const u = 1 - db / BOUND_R; nY -= u; if (u > pen) pen = u; }
  const e = Math.min(dl, dr, dt, db);
  if (e < boundMinEdge) boundMinEdge = e;
  if (pen <= 0) return null;
  if (pen > boundPeak) boundPeak = pen;
  const m = Math.hypot(nX, nY) || 1;
  return [nX / m, nY / m, pen];
}

const freshMem = o => frame - o.memT < MEM_FRAMES;

/* --------------------- 3. 绉嶇兢鐘舵€佷笌鍒濆鍖?--------------------- */

// ---- 妞嬮笩: 绱у噾鏁扮粍甯冨眬(棰勫垎閰嶅埌 MAXN, 婊戞潌鏀?N 涓嶉渶瑕侀噸鏂板垎閰? ----
const P = new Float32Array(MAXN * 2);
const V = new Float32Array(MAXN * 2);
const ACC = new Float32Array(MAXN * 2);
const alive = new Uint8Array(MAXN);
const isMobber = new Uint8Array(MAXN);    // C: 璇ラ笩鏄笉鏄?鍥存敾鑰?(寮€灞€鎸夋鐜囨娊鍙?
const PV = new Float32Array(MAXN * 2);    // P4: 涓婁竴甯ч€熷害(鎯婇鍒ゆ嵁鐢?
const startled = new Uint8Array(MAXN);    // P4: 鏈抚鏄惁鎯婇(蹇呴』鍦ㄨ鐩?PV 涔嬪墠绠楀嚭鏉?
const Z = new Float32Array(MAXN);         // 绗?8 杞? 楂樺害(z 杞? 涓?xy 瑙ｈ€?
const VZ = new Float32Array(MAXN);        // 绗?8 杞? 鍨傜洿閫熷害
const ZT = new Float32Array(MAXN);        // 绗?8 杞慨姝? 姣忓彧楦熺殑"涓汉椋炶灞?(鍒濆€兼娊涓€娆? 璁╀簯鍥㈡湁鍘氬害)
let aliveCount = 0;
// 姝讳骸娑熸吉: 瀹氬鐜舰姹?鏃х増鏄暟缁?push + render 閲?splice, 姣忓抚閮藉湪鎸唴瀛?
const DEATH_CAP = 512;
const deathX = new Float32Array(DEATH_CAP), deathY = new Float32Array(DEATH_CAP), deathT = new Float32Array(DEATH_CAP);
let deathCursor = 0;
function addDeath(x, y) {
  deathX[deathCursor] = x; deathY[deathCursor] = y; deathT[deathCursor] = 1;
  deathCursor = (deathCursor + 1) % DEATH_CAP;
}

// ---- 闆?----
const P2 = new Float32Array(M * 2);
const V2 = new Float32Array(M * 2);
const Z2 = new Float32Array(M);           // 绗?8 杞? 闆佺殑楂樺害
const VZ2 = new Float32Array(M);
const galive = new Uint8Array(M);
let galiveCount = M;
let leaderAng = 0, Lx = 0, Ly = 0;        // 铏氭嫙棰嗛槦(浣嶇疆 = 褰撳墠 apex 闆佺殑浣嶇疆)
// P2: 涓績鍖栫З搴忕殑鐘舵€?let gooseShift = 0;                       // 妲戒綅搴忓彿骞崇Щ閲? slot(i) = (i + gooseShift) % M
let leaderIdx = 0;                        // 褰撳墠 apex 闆?杞€奸闃?
let disarray = 0;                         // 鏂╅娣蜂贡鏈熷墿浣欏抚鏁?let gooseDebuff = 0;                      // 骞奸泚姝讳骸鍚庣殑娌抚鏈熷墿浣欏抚鏁?const slotRank = new Int16Array(M);       // 妲戒綅 -> 鎺掑彿(0 = apex)
const slotArm = new Int8Array(M);         // 妲戒綅 -> 卤1(宸﹀彸鑷?
let juvCount = 0;                         // 骞奸泚鍙暟(鍥哄畾涓綋: i % 4 === 0)
function isJuvenile(i) { return i % 4 === 0; }   // 25%(M=60 -> 15 鍙?

// ---- 缃戞牸鍝堝笇(姣忓抚閲嶅缓): 缁忓吀閾捐〃姹犲寲, 闆跺垎閰?----
// 鏃х増鏄?Map<key, number[]> + 姣忓抚鏂板缓鏁扮櫨涓皬鏁扮粍 -> GC 閿娇銆?// 鐜板湪: head = Int32Array(GW*GH) 姣忓抚鍙?fill(-1), next = Int32Array(MAXN) 瀛樺悓妗跺悗缁?
// 鎻掓《 O(1), 閬嶅巻璧?next 閾? 鍏ㄧ▼瀹氬瀷鏁扮粍, 娌℃湁浠讳綍鍫嗗垎閰嶃€?const gridNext = new Int32Array(MAXN);
let gridHead = new Int32Array(1);
let cellOrder = new Int32Array(1), cellOrderN = 0;   // 妗剁殑"棣栨鍑虹幇椤哄簭"(= 鏃?Map 鐨勬彃鍏ラ『搴?
let chainBuf = new Int32Array(MAXN);                 // 閫嗛摼鎴愬崌搴忕敤
function allocGrid() {
  const n = Math.max(1, GW * GH);
  gridHead = new Int32Array(n);
  cellOrder = new Int32Array(n);
}
const cellOf = (x, y) =>
  clamp(Math.floor((y + PAD) / CELL), 0, GH - 1) * GW +
  clamp(Math.floor((x + PAD) / CELL), 0, GW - 1);

// ---- 鎷撴墤閭诲眳澶嶇敤鐨勪复鏃舵暟缁?閬垮厤姣忓抚鍒嗛厤) ----
const KD = new Float64Array(TOPO_MAX);
const KX = new Float64Array(TOPO_MAX), KY = new Float64Array(TOPO_MAX);
const KJ = new Int32Array(TOPO_MAX);

// ---- 鐚涚 ----
// mem: 鏈€鍚庝竴娆?鐪嬪埌鐚庣墿"鐨勪綅缃?甯у彿), 鐢ㄤ簬寮€闃斾笘鐣岄噷缁х画鎼滅储
// dashEats: 鏈鍐插埡鍚冨埌鍑犲彧(A: 鍐插埡缁撴潫浠嶄负 0 -> 绌哄啿鍒虹綒娆?
// mob: 鏈抚琚嚑鍙洿鏀昏€呭洿浣?C)  stun: 浜掓敾璐ュ寳鍚庣殑鐪╂檿甯ф暟(E)
// lockIdx: 鍐插埡閿佸畾鐨勯笩绱㈠紩(D: 杩锋儜鏁堝簲), -1 = 鏈攣瀹?// policy: P3 鐨?(1+1)-ES 绛栫暐鍙傛暟(褰掍竴鍖?[0,1] 瀛樺偍), 瑙?esTick()
function makePolicy() {
  return {
    p: new Float64Array([norm(P_DASH_MIN), norm(P_ENERGY_LOW), norm(P_DOUBLE_TEAM),
                         norm(P_INTERCEPT), norm(P_MOB_TOL)]),   // 褰撳墠鐢熸晥鍙傛暟
    evalP: null,          // 鏈瘎浼版湡瀹為檯鍦ㄨ窇鐨勫弬鏁?    isCand: false,        // 鏈湡璺戠殑鏄€欓€夊悧
    baseFit: -Infinity,   // 鏈熷垵鍩哄噯閫傚簲搴?涓婁竴鏈熺殑鍑€鍊?
    lastFit: 0,           // 鏈€杩戜竴娆¤瘎浼版湡鐨勯€傚簲搴?    t: 0,                 // 鏈熷唴宸茶窇甯ф暟
    gen: 0,               // 鎴愬姛閲囩撼鐨勬鏁?绛栫暐浠ｆ暟)
    periods: 0,
    // 鏈熷唴绱姞閲?绠楅€傚簲搴︾敤)
    score0: 0, miss: 0, metab: 0,
  };
}
function norm(spec) { return (spec[2] - spec[0]) / (spec[1] - spec[0]); }
function denorm(spec, u) { return spec[0] + clamp(u, 0, 1) * (spec[1] - spec[0]); }
// 褰掍竴鍖栧弬鏁?-> 瀹為檯浣跨敤鍊?鍐欒繘澶嶇敤瀵硅薄, 閬垮厤姣忓彧闅兼瘡甯т竴涓璞″瓧闈㈤噺)
const PVV = { dashMin: 0, energyLow: 0, doubleTeam: 0, interceptAhead: 0, mobTol: 0 };
function policyVals(f) {
  const p = f.policy.evalP || f.policy.p;
  PVV.dashMin = denorm(P_DASH_MIN, p[0]);
  PVV.energyLow = denorm(P_ENERGY_LOW, p[1]);
  PVV.doubleTeam = denorm(P_DOUBLE_TEAM, p[2]);
  PVV.interceptAhead = denorm(P_INTERCEPT, p[3]);
  PVV.mobTol = denorm(P_MOB_TOL, p[4]);
  return PVV;
}
let falconSeq = 0;                        // task-3: 姣忓彧闅间竴涓‘瀹氭€х殑绉佹湁闅忔満绉嶅瓙(涓嶆秷鑰楀叏灞€ Math.random)
function makeFalcon(color, label, x, y, vx, vy, circleT) {
  return { x, y, vx, vy, z: 140, vz: 0, targetZ: -1, color, label, kind: "falcon",
           energy: ENERGY_MAX, dashT: 0, circleT, dashEats: 0, lockIdx: -1, stoopT: 0,
           rng: (Math.imul(++falconSeq, 0x9e3779b9) ^ 0x5f356495) >>> 0 || 1,
           mob: 0, stun: 0, clashCd: 0,
           policy: makePolicy(),
           trailBuf: new Float32Array(TRAIL_LEN * 3), trailN: 0, trailHead: 0,   // 绗?8 杞? 3D 鎷栧熬
           shock: null, seeing: false,
           memX: x, memY: y, memT: -1e9, score: 0, kills: 0, pending: 0 };
}
/* 绗?7 杞? 楣颁篃鍙樻垚宸ュ巶 + 鏁扮粍, 杩欐牱"鍔犲叆楣?鎸夐挳鍙互闅忔椂澧炴彺(姣忓彧楣版湁鑷繁鐙珛鐨?Q 琛? */
function makeEagle(x, y, label) {
  return { x, y, vx: 0, vy: 0, z: Z_INIT, vz: 0, targetZ: -1, kind: "eagle",
           color: "255,190,60", label: label || "楣?EAGLE",
           score: 0, kills: 0, pending: 0, seeing: false,
           dietStarling: 0, dietGoose: 0,
           eps: EPS0, Q: new Float32Array(N_STATES * N_ACTIONS),
           lastState: 0, lastAction: 0, curState: STATE_NONE, curAction: 2,
           hold: 0, holdState: STATE_NONE, holdAction: 2,
           dashT: 0, cool: 0, dashEats: 0, lockIdx: -1, stoopT: 0,
           mob: 0, stun: 0, clashCd: 0,
           trailBuf: new Float32Array(TRAIL_LEN * 3), trailN: 0, trailHead: 0,   // 绗?8 杞? 3D 鎷栧熬
           shock: null,
           memX: x, memY: y, memT: -1e9 };
}
const falcons = [
  makeFalcon("235,70,70",  "闅尖憼 FALCON",   W / 2, -40,   0,  CIRCLE_SPEED, 30),
  makeFalcon("70,150,255", "闅尖憽 FALCON-2", W / 2, H + 40, 0, -CIRCLE_SPEED, 200),
];
let activeId = 0;                          // 褰撳墠杩界寧鏂? 鍏朵粬浜鸿浼?+ 鎭㈠

// 楣? Q 琛ㄥ湪绾垮涔犵寧鐗╁亸濂? pending 绱Н"鏈抚鍚冨埌鐨勫垎", 甯ф湯鍥炴祦缁?Q 鏇存柊
// (eagles[0] 灏辨槸鍘熸潵鐨?楣?, 闈㈡澘 Q 琛ㄧ儹鍔涘浘涓?SIM.Q/eps 閮芥寚鍚戝畠, 淇濊瘉鏃㈡湁濂戠害涓嶅彉)
const eagles = [makeEagle(W * 0.7, H * 0.7, "楣?EAGLE")];
let eagle = eagles[0] || null;                 // 銆愮 8 杞慨姝ｃ€戝師涓?const 鍒悕: 楣板噺鍒?0 鍐嶈ˉ涓€鍙悗,
                                               // 瀹冧粛鎸囧悜"宸茶绉婚櫎鐨勯偅鍙?, 浜庢槸 Q 琛ㄧ儹鍔涘浘/閮ㄥ垎閽╁瓙璇诲埌姝诲璞°€?function syncRaptorRefs() {
  eagle = eagles[0] || null;                   // 璁╁埆鍚嶅缁堟寚鍚戝綋鍓嶇涓€鍙拱
  falcons.forEach((f, i) => f.label = "闅? + (CN_NUM[i] || ("#" + (i + 1))) + " FALCON" + (i > 0 ? "-" + (i + 1) : ""));
  eagles.forEach((E, i) => E.label = "楣? + (CN_NUM[i] || ("#" + (i + 1))) + " EAGLE" + (i > 0 ? "-" + (i + 1) : ""));
}

const raptors = [...falcons, ...eagles];   // E: 鐚涚涔嬮棿浼氫簰鏀?椹遍亗鍒?
const threats = raptors;                   // 楦熺殑閫冮€镐笌琚崟椋熷垽瀹氬鍚屼竴鎵瑰璞＄敓鏁?
/* ---- 绗?7 杞? 闅忔椂澧炴彺鐚涚(鎸夐挳"鍔犲叆楣?闅?涓?SIM.addFalcon/addEagle 閮借蛋杩欓噷) ---- */
const FALCON_COLORS = ["235,70,70", "70,150,255", "240,140,60", "180,90,230", "90,220,180", "230,120,190"];
const CN_NUM = ["鈶?, "鈶?, "鈶?, "鈶?, "鈶?, "鈶?, "鈶?, "鈶?, "鈶?, "鈶?];
function spawnRaptor(kind) {
  // 鍦ㄩ笩缇よ川蹇冮檮杩戠殑涓€涓浐瀹氬崐寰勭幆涓婂叆鍦?璐ㄥ績鐢?6.1/6.2 姣忓抚鏇存柊)
  const ang = Math.random() * TAU, r = 260 + Math.random() * 160;
  const x = wrapX(cxmI + Math.cos(ang) * r), y = wrapY(cymI + Math.sin(ang) * r);
  let r2;
  if (kind === "eagle") {
    const k = eagles.length;
    r2 = makeEagle(x, y, "楣? + (CN_NUM[k] || ("#" + (k + 1))) + " EAGLE");
    eagles.push(r2);
  } else {
    const k = falcons.length;
    r2 = makeFalcon(FALCON_COLORS[k % FALCON_COLORS.length],
                    "闅? + (CN_NUM[k] || ("#" + (k + 1))) + " FALCON",
                    x, y, 0, 0, Math.floor(Math.random() * CIRCLE_FRAMES));
    falcons.push(r2);
  }
  r2.z = 120 + Math.random() * 100;        // 绗?8 杞? 澧炴彺浠庝笉鍚岄珮搴﹀叆鍦?  r2.targetZ = -1;
  raptors.push(r2);                        // threats 涓?raptors 鏄悓涓€涓暟缁勫璞?  syncRaptorRefs();                        // 鏂颁釜浣撳叆鍦哄悗鍚屾楣板埆鍚嶄笌缂栧彿
  logDec(6, raptors.length - 1, "澧炴彺鍏ュ満: " + r2.label + "(鐜版湁闅?" + falcons.length + " 鍙?/ 楣?" + eagles.length + " 鍙?");
  refreshRaidLine();                       // 鏃犺浠庢寜閽繕鏄?SIM 鎺ュ彛璋冪敤, 闈㈡澘缂栧埗琛岀珛鍒诲悓姝?  return r2;
}

/* 绗?8 杞? 涓€閿噺鍛?闈㈡澘鎸夐挳 / Shift+F / Shift+E)銆傞毤鑷冲皯鐣?1 鍙?杞崲鍒跺害闇€瑕?,
 * 楣板彲浠ュ噺鍒?0(姝ゆ椂闈㈡澘 Q 琛ㄤ笌楣伴璋辫鐣欑┖鏄剧ず)銆?*/
function removeRaptor(kind) {
  if (kind === "falcon" && falcons.length > 0) {        // 銆愮 8 杞慨姝ｂ懀銆戝厑璁稿噺鍒?0 鍙?绾笩缇よ瀵?
    const g = falcons.pop();
    const at = raptors.indexOf(g); if (at >= 0) raptors.splice(at, 1);
    activeId = falcons.length ? (activeId % falcons.length) : 0;
  } else if (kind === "eagle" && eagles.length > 0) {
    const g = eagles.pop();
    const at = raptors.indexOf(g); if (at >= 0) raptors.splice(at, 1);
  }
  syncRaptorRefs();                       // 銆愮 8 杞慨姝ｃ€戝噺鍛樺悗鍚屾楣板埆鍚嶄笌缂栧彿(鍚﹀垯 Q 琛ㄨ姝诲璞?
  refreshRaidLine();
}

const stats = { steps: 0, kills: 0, wave: 0,
                missFalcon: 0, missEagle: 0,     // A: 绌哄啿鍒烘儵缃氭鏁?                mobInterrupts: 0,                // C: 琚洿鏀绘墦鏂殑鍐插埡娆℃暟
                lockedDashes: 0,                 // D: 甯﹂攣瀹氱殑鍐插埡娆℃暟
                clashes: 0, steals: 0,           // E: 浜掓敾/鎶㈠垎娆℃暟
                // 绗?4 杞?                dashEnds: 0, dashEndBirds: 0,    // P1: 鍐插埡缁撴潫鏃剁粓鐐?80px 鍐呯殑鍙楦熸暟
                dashMaxEats: 0,                  // P1: 鍗曟鍐插埡鏈€澶氬悆鍑犲彧妞嬮笩
                dashMaxEatsLocked: 0,            // P1: 閿佸畾鍐插埡(鎹曠寧)鍗曟鏈€澶氬悆鍑犲彧(搴?<= 1)
                dashMaxEatsFree: 0,              // P1: 鏈攣瀹氬啿鍒?椹遍€?杩介泚)鍗曟鏈€澶氬悆鍑犲彧
                dashEndInCone: 0,                // P2D: 鍐插埡缁堢偣钀藉湪濞佹厬閿ュ唴鐨勬鏁?                dashEndApexSum: 0, dashEndApexNear: 0,   // P2D: 缁堢偣鍒?V 灏栫殑璺濈(鍜?/ <200px 娆℃暟)
                apexDistSum: 0, apexDistSamples: 0, apexClose: 0,  // P2A: 闆佸皷涓庢渶杩戦毤鐨勮窛绂婚噰鏍?                noLockAborts: 0,                 // P1: 閲囨牱鍒扮洰鏍囦絾 40px 鍐呮棤楦?-> 鏀惧純鍐插埡
                gooseAlerts: 0, gooseFalseAlerts: 0,  // P4: 鍊熺綉棰勮 / 鍏朵腑鏃犵寷绂藉湪 400px 鍐呯殑璇姤
                gooseDisarray: 0,                // P2E: 鏂╅娣蜂贡娆℃暟
                juvenileLost: 0,                 // P2C: 骞奸泚姝讳骸娆℃暟
                coneFalconFrames: 0, coneEagleDrain: 0,  // P2D: 閿ュ唴澶辫甯ф暟
                esAdopt: 0, esPeriods: 0 };      // P3: 闅肩瓥鐣ラ噰绾虫鏁?/ 璇勪及鏈熸暟
let frame = 0;
let esEvalOverride = 0;                          // 浠呰皟璇曠敤: 缂╃煭 ES 璇勪及鏈?0 = 鐢?ES_EVAL_FRAMES)

/* ---- 绗?8 杞? 鐚涚鍐崇瓥鏃ュ織(瀹氬鐜舰姹? ----
 * 璁板綍: 楣扮殑鐘舵€?鍔ㄤ綔鍐崇瓥銆佸彂璧峰啿鍒恒€佸啿鍒鸿惤绌恒€佺┖鍐插埡缃氭銆佷簰鏀诲垽鑳溿€丒S 閲囩撼銆佺紪鍒跺鍑忋€? * 鐢ㄩ€? 闈㈡澘鏈€鍚庡嚑琛?+ console(?log=1) + SIM.log()/SIM.logTail(n) 渚涜剼鏈獙鏀跺彇璇併€? * 娉ㄦ剰: 鐑矾寰勯噷鍙啓瀹氬鏁扮粍(鏃犳柊瀵硅薄); 鍙湁琚鍑烘潵鏃舵墠寤哄皬瀵硅薄銆?*/
const DEC_CAP = 400;
const decT = new Int32Array(DEC_CAP);       // 甯у彿
const decKind = new Uint8Array(DEC_CAP);    // 绫诲埆
const decWho = new Uint8Array(DEC_CAP);     // 鐚涚涓嬫爣(255 = 闈炰釜浣?
const decMsg = new Array(DEC_CAP).fill(""); // 鏂囨湰
let decN = 0, decHead = 0, decSeq = 0;
let decLogOn = false;
try { decLogOn = /[?&]log=1/.test(window.location.search); } catch (e) { /* headless */ }
const DEC_KIND = ["楣板喅绛?, "鍙戣捣鍐插埡", "鍐插埡钀界┖", "绌哄啿鍒虹綒娆?, "浜掓敾", "ES閲囩撼", "缂栧埗"];
function decWhoName(who) {
  if (who === 255) return "-";
  if (who < falcons.length) return falcons[who].label.split(" ")[0];
  const ei = who - falcons.length;
  return ei < eagles.length ? eagles[ei].label.split(" ")[0] : ("#" + who);
}
function logDec(kind, who, msg) {
  const i = decHead;
  decT[i] = frame; decKind[i] = kind; decWho[i] = who; decMsg[i] = msg;
  decHead = (decHead + 1) % DEC_CAP;
  if (decN < DEC_CAP) decN++;
  decSeq++;
  if (decLogOn) console.info("[DEC f" + frame + " " + DEC_KIND[kind] + " " + decWhoName(who) + "] " + msg);
}
function decTail(n) {                       // 鍙栨渶杩?n 鏉?鏃?-> 鏂?
  const out = [];
  const k = Math.min(n, decN);
  for (let j = 0; j < k; j++) {
    const i = (decHead - k + j + 2 * DEC_CAP) % DEC_CAP;
    out.push({ frame: decT[i], kind: DEC_KIND[decKind[i]], who: decWhoName(decWho[i]), msg: decMsg[i] });
  }
  return out;
}

/* ---- 鍒濆鍖?---- */

function initStarlings() {
  alive.fill(0);
  isMobber.fill(0);
  startled.fill(0);
  PV.fill(0);
  for (let i = 0; i < N; i++) {
    alive[i] = 1;
    isMobber[i] = Math.random() < MOB_FRACTION ? 1 : 0;   // C: 閲嶆娊鍥存敾鑰呰韩浠?    P[2*i]   = wrapX(W / 2 + randn() * 200);
    P[2*i+1] = wrapY(H / 2 + randn() * 200);
    if (GRAV_ON) {                                       // 瀹堟亽绾夸慨琛? 鍏抽噸鍔涙椂涓嶆秷鑰楅殢鏈烘暟
      ZT[i] = Z_INIT + randn() * Z_SPREAD * ZT_SPREAD_K;   // 涓汉椋炶灞?鍐冲畾浜戝洟鍘氬害)
      Z[i] = Math.max(FLOOR_Z + 20, ZT[i]);   // 绗?8 杞? 鍒濆浜戝洟楂樺害
      VZ[i] = (Math.random() - 0.5) * 0.6;
    } else { Z[i] = 0; VZ[i] = 0; }
    const a = Math.random() * TAU;
    V[2*i]   = Math.cos(a) * MAX_SPEED * 0.5;
    V[2*i+1] = Math.sin(a) * MAX_SPEED * 0.5;
    PV[2*i]   = V[2*i];                     // P4: 涓婁竴甯ч€熷害鍒濆鍖? 閬垮厤寮€灞€鍏ㄤ綋璇姤鎯婇
    PV[2*i+1] = V[2*i+1];
  }
  aliveCount = N;
  deathT.fill(0); deathCursor = 0;
  migAng = Math.random() * TAU;
}

/* ---- P2: 闆佺兢鐨勬Ы浣嶅嚑浣曚笌杞€?------------------------------------------
 * 妲戒綅缂栧彿 slot(i) = (i + gooseShift) % M; 妲戒綅 0 鎭掍负 apex(V 灏?銆? * 鎺掑彿/宸﹀彸鑷傜敱妲戒綅绱㈠紩鍐冲畾, 浣?*骞奸泚鐨勫唴閬撲紭鍏?*闈?娈嬬被"瀹炵幇:
 * 骞奸泚鏄浐瀹氫釜浣?i%4===0, 25%), 骞崇Щ閲忔寜 M=60 鍙栨ā, 鑰?4 | 60, 鎵€浠? * "i%4===0 鐨勯泚" 姘歌繙钀藉湪妲戒綅娈嬬被 (gooseShift%4) 閲?鈥斺€?鎶婅繖涓€娈嬬被鐨勬Ы浣? * 鎺掓垚鍐呴亾(灏忔帓鍙?, 骞奸泚灏辨案杩滃湪鍐呴亾, 鎹㈠矖涔熶笉浼氭崲鍑哄唴閬撱€?*/
function rebuildFormation() {
  const juvRes = ((gooseShift % 4) + 4) % 4;
  const inner = [], outer = [];
  for (let s = 0; s < M; s++) {
    if (s === 0) continue;                  // 0 鍙锋Ы鍥哄畾鏄?apex
    if (s % 4 === juvRes) inner.push(s); else outer.push(s);
  }
  slotRank[0] = 0; slotArm[0] = 1;
  let rank = 1;
  for (let k = 0; k < inner.length; k += 2) {          // 鍐呴亾: 骞奸泚
    slotRank[inner[k]] = rank; slotArm[inner[k]] = 1;
    if (k + 1 < inner.length) { slotRank[inner[k + 1]] = rank; slotArm[inner[k + 1]] = -1; }
    rank++;
  }
  for (let k = 0; k < outer.length; k += 2) {          // 澶栭亾: 鎴愰泚
    slotRank[outer[k]] = rank; slotArm[outer[k]] = 1;
    if (k + 1 < outer.length) { slotRank[outer[k + 1]] = rank; slotArm[outer[k + 1]] = -1; }
    rank++;
  }
}

// 闆?i 鐨勭洰鏍囨Ы浣嶅潗鏍?apex = (Lx,Ly), 鑸悜 leaderAng)
function gooseSlot(i) {
  const s = (i + gooseShift) % M;
  const rank = slotRank[s], arm = slotArm[s];
  const back = rank * SLOT_SPACING;
  const side = arm * rank * SLOT_SPACING * 0.36;
  const hx = Math.cos(leaderAng), hy = Math.sin(leaderAng);
  return { x: wrapX(Lx - hx * back - hy * side), y: wrapY(Ly - hy * back + hx * side) };
}

// 濞佹厬閿ュ垽瀹?2D, perceive 鎵撳垎鐢?鈥斺€?杩戜技: 鍙湅鐨勬按骞抽潰鎶曞奖)
function inCone(px, py) {
  const dx = minImageX(px - Lx), dy = minImageY(py - Ly);
  const d2 = dx * dx + dy * dy;
  if (d2 > CONE_R * CONE_R) return false;
  const d = Math.sqrt(d2) || 1;
  return (dx / d) * Math.cos(leaderAng) + (dy / d) * Math.sin(leaderAng) > CONE_COS;
}

// 绗?8 杞? 濞佹厬閿?3D 鐗?澶辫/鑳借€楀垽瀹氱敤)銆傝酱 = (棰嗛槦鑸悜, 棰嗛槦鍨傜洿閫熷害鐨?1/4 鍊捐),
// 鍗婅/鍗婂緞涓嶅彉 鈥斺€?闆佹姮澶寸埇鍗囨椂閿ュ悜涓婄繕, 淇啿鏃跺悜涓嬫墸銆?function inCone3(px, py, pz) {
  const dx = minImageX(px - Lx), dy = minImageY(py - Ly), dz = GRAV_ON ? pz - Z2[leaderIdx] : 0;
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 > CONE_R * CONE_R) return false;
  const d = Math.sqrt(d2) || 1;
  const az2 = clamp(VZ2[leaderIdx] * 0.25, -0.45, 0.45);
  const al = Math.hypot(1, az2);
  return (dx * Math.cos(leaderAng) + dy * Math.sin(leaderAng) + dz * az2) / (d * al) > CONE_COS;
}

// 闆?i 鐨勬浜℃祦绋? 骞奸泚 -> 鍏ㄤ綋娌抚鏈?P2C); apex -> 鏂╅娣蜂贡鏈?P2E)銆?// 琚悆涓庤皟璇曢挬瀛?SIM.killGoose)鍏辩敤鍚屼竴鏉¤矾寰? 淇濊瘉娴嬭瘯娴嬬殑灏辨槸鐪熷疄琛屼负銆?function gooseDies(i) {
  if (!galive[i]) return;
  addDeath(P2[2*i], P2[2*i+1]);
  galive[i] = 0; galiveCount--;
  if (isJuvenile(i)) { gooseDebuff = JUVENILE_DEBUFF_FRAMES; stats.juvenileLost++; }
  if (i === leaderIdx) {
    disarray = DISARRAY_FRAMES;
    stats.gooseDisarray++;
    rotateLeader();                            // 鍏堣涓€涓柊 apex, 娣蜂贡缁撴潫鍚庢寜瀹冮噸寤?  }
}

// 鎶?apex 鎹㈠埌涓嬩竴鍙椿闆?杞€?/ 娣蜂贡鍚庨噸寤?; 杩斿洖鏄惁鎴愬姛銆?// 涓嶅彉寮? slot(leaderIdx) = (leaderIdx + gooseShift) % M = 0銆?// 瑕佹妸 apex 鍓嶈繘 k 鍙? 骞崇Щ閲忓繀椤?*鍑?* k(鍥犱负 leaderIdx = -gooseShift mod M)銆?function rotateLeader() {
  for (let k = 1; k <= M; k++) {
    const cand = (leaderIdx + k) % M;
    if (galive[cand]) {
      gooseShift = ((gooseShift - k) % M + M) % M;   // 妲戒綅搴忓彿骞崇Щ
      leaderIdx = cand;
      rebuildFormation();
      return true;
    }
  }
  return false;
}

function initGeese() {
  galive.fill(1); galiveCount = M;
  leaderAng = Math.random() * TAU;
  Lx = wrapX(W * 0.3); Ly = wrapY(H * 0.3);
  gooseShift = 0; leaderIdx = 0; disarray = 0; gooseDebuff = 0;
  juvCount = 0;
  for (let i = 0; i < M; i++) if (isJuvenile(i)) juvCount++;
  rebuildFormation();
  for (let i = 0; i < M; i++) { Z2[i] = GOOSE_LAYER + (i % 5) * 6; VZ2[i] = 0; }   // 绗?8 杞? 闆佸湪鏄庢樉鏇撮珮鐨勭ǔ瀹氬眰(鍒嗗眰鍙)
  const hx = Math.cos(leaderAng), hy = Math.sin(leaderAng);
  for (let i = 0; i < M; i++) {
    const s = gooseSlot(i);
    P2[2*i] = s.x; P2[2*i+1] = s.y;
    V2[2*i] = hx * LEADER_SPEED; V2[2*i+1] = hy * LEADER_SPEED;
  }
  Lx = P2[2*leaderIdx]; Ly = P2[2*leaderIdx+1];   // 铏氭嫙棰嗛槦 = apex 闆佸綋鍓嶄綅缃?}

function resetFlocks() { initStarlings(); initGeese(); }

// 鐚涚鍥炲埌璧峰鐘舵€?浣嶇疆/鑳介噺/璁板繂/鎷栧熬), 璁″垎淇濈暀銆?// 绗?7 杞? "閲嶇疆鐚涚"鍚屾椂鎶婂鎻磋В鏁?鈥斺€?鍥炲埌榛樿缂栧埗(2 闅?+ 1 楣?, 杩欐牱鎸夐挳鍙€嗐€?function resetPredators() {
  const inOpen = !TORUS;
  // 瑙ｆ暎澧炴彺: 鍙繚鐣?falcons[0..1] 涓?eagles[0], 骞朵粠 raptors 閲屾憳鎺夊浣欑殑
  while (falcons.length > 2) { const gone = falcons.pop(); const at = raptors.indexOf(gone); if (at >= 0) raptors.splice(at, 1); }
  while (eagles.length > 1)  { const gone = eagles.pop();  const at = raptors.indexOf(gone); if (at >= 0) raptors.splice(at, 1); }
  // 銆愮 8 杞慨姝ｂ懀銆?閲嶇疆鐚涚" = 鍥炲埌榛樿缂栧埗: 琚噺鎺夌殑闅?楣拌閲嶅缓鍥炴潵(闅煎彲鍑忓埌 0 涔嬪悗蹇呴』)
  while (falcons.length < 2) {
    const k = falcons.length;
    const nf = makeFalcon(FALCON_COLORS[k % FALCON_COLORS.length],
      "闅? + (CN_NUM[k] || ("#" + (k + 1))) + " FALCON" + (k > 0 ? "-" + (k + 1) : ""),
      W / 2, inOpen ? (k ? H + 40 : -40) : H * (k ? 0.85 : 0.15),
      0, k ? -CIRCLE_SPEED : CIRCLE_SPEED, k ? 200 : 30);
    falcons.push(nf); raptors.push(nf);
  }
  while (eagles.length < 1) { const ne = makeEagle(W * 0.7, H * 0.7, "楣扳憼 EAGLE"); eagles.push(ne); raptors.push(ne); }
  const f0 = falcons[0], f1 = falcons[1];
  f0.x = W / 2; f0.y = inOpen ? -40 : H * 0.15; f0.vx = 0; f0.vy = CIRCLE_SPEED; f0.circleT = 30;
  f1.x = W / 2; f1.y = inOpen ? H + 40 : H * 0.85; f1.vx = 0; f1.vy = -CIRCLE_SPEED; f1.circleT = 200;
  for (const f of falcons) {
    f.energy = ENERGY_MAX; f.dashT = 0; f.trailN = 0; f.trailHead = 0; f.shock = null;
    f.memX = W / 2; f.memY = H / 2; f.memT = -1e9; f.seeing = false;
    f.dashEats = 0; f.lockIdx = -1; f.mob = 0; f.stun = 0; f.clashCd = 0;
    f.z = 140; f.vz = 0; f.targetZ = -1;                              // 绗?8 杞?  }
  activeId = 0;
  syncRaptorRefs();
  for (let i = 0; i < eagles.length; i++) {
    const E = eagles[i];
    E.x = W * 0.7; E.y = H * 0.7; E.vx = 0; E.vy = 0;
    E.dashT = 0; E.cool = 0; E.trailN = 0; E.trailHead = 0; E.shock = null;
    E.memX = W * 0.5; E.memY = H * 0.5; E.memT = -1e9; E.seeing = false;
    E.lastState = 0; E.lastAction = 0; E.pending = 0;
    E.dashEats = 0; E.lockIdx = -1; E.mob = 0; E.stun = 0; E.clashCd = 0;
    E.hold = 0; E.holdState = STATE_NONE; E.holdAction = 2;
    E.z = Z_INIT; E.vz = 0; E.targetZ = -1;                           // 绗?8 杞?  }
}

// 鍑犱綍鍒囨崲: 鏀逛笘鐣屽昂瀵?+ 閲嶇疆浣嶇疆(鍚﹀垯楦熶細钀藉湪鏂扮殑澧欏)
function setGeometry(torus) {
  TORUS = !!torus;
  PAD = TORUS ? 0 : PAD_OPEN;
  recomputeGridSize();
  resetFlocks();
  resetPredators();
}

function setN(v) {
  N = clamp(Math.round(v), 100, MAXN);
  initStarlings();
}

/* --------------------- 4. 鑷姩琛ュ厖鐚庣墿 --------------------- */

// 鍥涗釜琛ュ厖鏂瑰悜(甯搁噺, 閬垮厤姣忔琛ュ厖鏃舵柊寤哄璞″瓧闈㈤噺鏁扮粍)
const REFILL_SIDES = [
  { x: -PAD - 20, y: H / 2, inx: 1, iny: 0 },
  { x: W + PAD + 20, y: H / 2, inx: -1, iny: 0 },
  { x: W / 2, y: -PAD - 20, inx: 0, iny: 1 },
  { x: W / 2, y: H + PAD + 20, inx: 0, iny: -1 },
];

// 姝讳骸澶鏃? 浠庣鐚涚鏈€杩滅殑涓€渚цˉ涓€娉? 璁╃珵璧涜兘闀挎椂闂寸湅涓嬪幓銆?// 涓よ稛鎵弿(鍏堟寫杈? 鍐嶅氨鍦板畨缃?, 涓嶅啀鏀堕泦 dead 绱㈠紩鏁扮粍銆?function refillStarlings() {
  let deadCount = 0;
  for (let i = 0; i < N; i++) if (!alive[i]) deadCount++;
  if (deadCount === 0) return;

  let best = REFILL_SIDES[0], bestD = -1;
  for (let s = 0; s < REFILL_SIDES.length; s++) {
    const sd = REFILL_SIDES[s];
    let dmin = 1e18;
    for (const f of threats) {
      const dx = minImageX(sd.x - f.x), dy = minImageY(sd.y - f.y);
      dmin = Math.min(dmin, dx * dx + dy * dy);
    }
    if (dmin > bestD) { bestD = dmin; best = sd; }
  }

  for (let i = 0; i < N; i++) {
    if (alive[i]) continue;
    const jx = best.inx !== 0 ? randn() * 25 : randn() * 200;
    const jy = best.iny !== 0 ? randn() * 25 : randn() * 200;
    P[2*i]   = wrapX(best.x + jx);
    P[2*i+1] = wrapY(best.y + jy);
    const vx = best.inx * MAX_SPEED * 0.6 + (Math.random() - 0.5) * 0.6;
    const vy = best.iny * MAX_SPEED * 0.6 + (Math.random() - 0.5) * 0.6;
    const vs = Math.hypot(vx, vy) || 1;
    V[2*i]   = vx / vs * MAX_SPEED * 0.6;
    V[2*i+1] = vy / vs * MAX_SPEED * 0.6;
    PV[2*i] = V[2*i]; PV[2*i+1] = V[2*i+1];
    startled[i] = 0;
    alive[i] = 1;
  }
  aliveCount += deadCount;
  stats.wave++;
}

function refillGeese() {
  const hx = Math.cos(leaderAng), hy = Math.sin(leaderAng);
  let added = 0;
  for (let i = 0; i < M; i++) {
    if (galive[i]) continue;
    const s = gooseSlot(i);
    P2[2*i] = s.x; P2[2*i+1] = s.y;
    V2[2*i] = hx * LEADER_SPEED; V2[2*i+1] = hy * LEADER_SPEED;
    galive[i] = 1; added++;
  }
  galiveCount += added;
}

function maybeRefill() {
  if (!refillOn) return;
  if (aliveCount < N * REFILL_RATIO) refillStarlings();
  if (galiveCount < M * REFILL_G_RATIO) refillGeese();
}

/* --------------------- 5. 鐚涚鎰熺煡涓庨噰鏍风洰鏍囪幏鍙?鏃犲叏灞€瑙嗛噹) --------------------- */

// 閲囨牱鐩爣鑾峰彇(P1)鐢ㄧ殑棰勮绠楅噺涓庡鐢ㄧ紦鍐?const CANDX = new Float64Array(N_CAND), CANDY = new Float64Array(N_CAND);
const CAND_R = new Float64Array(N_CAND);
for (let r = 0, k = 0; r < SAMPLE_RADII.length; r++) {
  for (let a = 0; a < SAMPLE_ANGLES; a++, k++) {
    const ang = a / SAMPLE_ANGLES * TAU;
    CANDX[k] = Math.cos(ang) * SAMPLE_RADII[r];
    CANDY[k] = Math.sin(ang) * SAMPLE_RADII[r];
    CAND_R[k] = SAMPLE_RADII[r];
  }
}
const candScore = new Float64Array(N_CAND);
const VIS = new Int32Array(MAXN);          // 瑙嗛噹鍐呭彲瑙佹楦熺储寮?澶嶇敤)
const ANG_BIN = TAU / SAMPLE_ANGLES;       // 姣忎釜鍊欓€夎搴﹀崰鐨勫姬搴?// 姣忎釜鐜殑"瑙掑害绐?鍗婂(鍗曚綅: 瑙掑害妲芥暟), 鍙?bd=ring 鏃剁殑鏈€鍧忔儏鍐?
//   螖胃_max = 2路asin(SCOOP_R / (2路ring)), 妲芥暟 = ceil(螖胃_max / ANG_BIN)
// 杩欐牱鍐呭眰寰幆閲屼笉鐢ㄥ啀鍋?asin/sqrt, 鍙渶 1 娆?atan2(姣忓彧楦?+ 鑻ュ共骞虫柟姣旇緝銆?const CAND_W = new Int32Array(SAMPLE_RADII.length);
const CAND_LO2 = new Float64Array(SAMPLE_RADII.length), CAND_HI2 = new Float64Array(SAMPLE_RADII.length);
for (let r = 0; r < SAMPLE_RADII.length; r++) {
  const rad = SAMPLE_RADII[r];
  const half = 2 * Math.asin(Math.min(1, SCOOP_R / (2 * rad)));
  CAND_W[r] = Math.min(Math.max(1, Math.ceil(half / ANG_BIN)), SAMPLE_ANGLES >> 1);
  const lo = Math.max(0, rad - SCOOP_R), hi = rad + SCOOP_R;
  CAND_LO2[r] = lo * lo; CAND_HI2[r] = hi * hi;
}

// perceive: 瑙嗛噹鍐呯殑妞嬮笩缁熻 + 閲囨牱鐩爣鑾峰彇銆?//   1) 娌跨敤妗跺績绮楃瓫 + 閫愬彧绮剧‘鍒よ窛, 鏀堕泦鍏ㄩ儴鍙妞嬮笩(璐ㄥ績 x,y / 鏁伴噺 n 鐓ф棫);
//   2) 姣忓彧楦熺疮鍔犺繘"璺濈 < SCOOP_R 鐨勬墍鏈夊€欓€夌偣"(80 涓瀬鍧愭爣鍊欓€?, 寰楀埌
//      "鍝釜浣嶇疆涓€灏忓嫼鑳芥崬鍒版渶澶氶笩";
//   3) 鎵撳垎 = 鎹炲埌鐨勯笩鏁?脳(1 + DIR_LAG路cos(鍊欓€夋柟鍚? 褰撳墠鑸悜)) 鈥斺€?鏂瑰悜婊炲悗闃叉姈鍔?
//      // 鎵╁睍浣? 闆佹潈閲?/ 濞佹厬閿ユ墸鍒?/ mob 鎵ｅ垎 閮藉彲浠ュ湪杩欓噷涔樹笂 (P2D 宸叉帴閿?
//   4) argmax 鍊欓€夌偣 = 鍐插埡涓績 (cx,cy); lockIdx = 涓績 LOCK_R 鍐呮渶杩戠殑楦?
//      40px 鍐呮病楦熷垯瑙嗕负"鐩爣涓嶅彲鐢?(caller 浼氭斁寮冭繖娆″啿鍒?銆?// bi 璇箟鏀逛负"涓績闄勮繎閭ｅ彧浠ｈ〃楦?(= lockIdx), 渚涗紡鍑绘寜瀹冪殑閫熷害澶栨帹銆?// 澶嶇敤鐨勮繑鍥炲璞?姣忓抚琚寷绂借皟鐢?3 娆?+ 鍐插埡鏀跺熬 1 娆?: 涓嶅啀姣忔鍒嗛厤瀵硅薄瀛楅潰閲?const PC = { x: 0, y: 0, n: 0, bi: -1, cx: -1, cy: -1, lockIdx: -1, score: 0, z: Z_INIT };

function perceive(px, py, vx, vy, viewR2) {
  const cellR = Math.sqrt(viewR2) + CELL * 0.75, cellR2 = cellR * cellR;
  const maxCandR = Math.sqrt(viewR2) - SCOOP_R;     // 鎹炲嫼浼稿嚭瑙嗛噹鐨勫€欓€夌偣鐩存帴涓嶈
  let cnt = 0, nVis = 0;
  let sumX = 0, sumY = 0, sumZ = 0, scx = 0, ssx = 0, scy = 0, ssy = 0;   // 绗?8 杞? sumZ
  candScore.fill(0);

  // 鎸?妗堕娆″嚭鐜伴『搴?閬嶅巻(浣嶇骇绛変环浜庢棫鐗堢殑 Map.forEach), 妗跺唴閫嗛摼鎴愬崌搴?  for (let oi = 0; oi < cellOrderN; oi++) {
    const c = cellOrder[oi];
    const cx = c % GW, cy = (c / GW) | 0;
    const bx = -PAD + (cx + 0.5) * CELL, by = -PAD + (cy + 0.5) * CELL;
    const dx = minImageX(bx - px), dy = minImageY(by - py);
    if (dx * dx + dy * dy > cellR2) continue;
    let m = 0;
    for (let j = gridHead[c]; j !== -1; j = gridNext[j]) chainBuf[m++] = j;   // 闄嶅簭鏀堕泦
    for (let q = m - 1; q >= 0; q--) {                                        // 鍗囧簭閬嶅巻
      const j = chainBuf[q];
      const ex = minImageX(P[2*j] - px), ey = minImageY(P[2*j+1] - py);
      const d2 = ex * ex + ey * ey;
      if (d2 > viewR2) continue;
      cnt++;
      if (nVis < MAXN) VIS[nVis++] = j;
      if (TORUS) {
        const ta = P[2*j] / W * TAU, tb = P[2*j+1] / H * TAU;
        scx += Math.cos(ta); ssx += Math.sin(ta);
        scy += Math.cos(tb); ssy += Math.sin(tb);
      } else { sumX += P[2*j]; sumY += P[2*j+1]; sumZ += Z[j]; }   // 绗?8 杞?
      // 杩欏彧楦熻兘琚摢浜涘€欓€夌偣"鎹?鍒? 涓ゅ眰棰勭瓫鎶?80 涓€欓€夌爫鍒?5~10 涓?
      //   1) 鍗婂緞: |ring - bd| < SCOOP_R(鐢ㄥ钩鏂规瘮杈? 涓?sqrt);
      //   2) 瑙掑害: 鍙瘯鏈€杩戣搴︽Ы 卤CAND_W[ring] 涓?鏈€鍧忔儏鍐电獥, 棰勮绠?銆?      const bang = Math.atan2(ey, ex);
      const c0 = Math.round(bang / ANG_BIN);
      for (let r = 0, k = 0; r < SAMPLE_RADII.length; r++, k += SAMPLE_ANGLES) {
        if (SAMPLE_RADII[r] > maxCandR || d2 < CAND_LO2[r] || d2 > CAND_HI2[r]) continue;
        const w = CAND_W[r];
        for (let o = -w; o <= w; o++) {
          let ai = (c0 + o) % SAMPLE_ANGLES; if (ai < 0) ai += SAMPLE_ANGLES;
          const kk = k + ai;
          const ddx = ex - CANDX[kk], ddy = ey - CANDY[kk];
          if (ddx * ddx + ddy * ddy < SCOOP_R2) candScore[kk] += 1;
        }
      }
    }
  }

  if (cnt === 0) return null;
  const mx = TORUS ? wrapX(Math.atan2(ssx, scx) / TAU * W) : sumX / cnt;
  const my = TORUS ? wrapY(Math.atan2(ssy, scy) / TAU * H) : sumY / cnt;

  // 鎵撳垎: 鏂瑰悜婊炲悗 + 濞佹厬閿ヤ箻椤?P2D: 璁╅€夌洰鏍囪嚜宸辩粫寮€闆佺兢姝ｉ潰, 涓嶅啓韬查伩纭紪鐮?
  const sp = Math.sqrt(vx * vx + vy * vy) || 1;
  const ux = vx / sp, uy = vy / sp;
  const coneOn = galiveCount > 0;
  let bestS = 0, bestK = -1;
  for (let k = 0; k < N_CAND; k++) {
    const base = candScore[k];
    if (base <= 0 || CAND_R[k] > maxCandR) continue;
    const d = CAND_R[k] || 1;
    let sc = base * (1 + DIR_LAG * ((CANDX[k] / d) * ux + (CANDY[k] / d) * uy));
    // 鎵╁睍浣? 闆佹潈閲?/ 濞佹厬閿ユ墸鍒?/ mob 鎵ｅ垎
    if (coneOn && inCone(px + CANDX[k], py + CANDY[k])) sc *= CONE_SCORE_FACTOR;
    if (sc > bestS) { bestS = sc; bestK = k; }
  }

  let cxT = -1, cyT = -1, lockIdx = -1;
  if (bestK >= 0) {
    cxT = px + CANDX[bestK]; cyT = py + CANDY[bestK];
    let bestD = LOCK_R2;                     // 涓績闄勮繎鏈€杩戠殑楦? 鍐插埡閫斾腑鍙悆瀹?    for (let v = 0; v < nVis; v++) {
      const j = VIS[v];
      const dx = minImageX(P[2*j] - cxT), dy = minImageY(P[2*j+1] - cyT);
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD) { bestD = d2; lockIdx = j; }
    }
    if (lockIdx < 0) { cxT = -1; cyT = -1; } // 40px 鍐呮棤楦?-> 鏈鏀惧純
  }
  PC.x = mx; PC.y = my; PC.n = cnt; PC.bi = lockIdx;
  PC.cx = cxT; PC.cy = cyT; PC.lockIdx = lockIdx; PC.score = bestS;
  PC.z = cnt ? sumZ / cnt : Z_INIT;          // 瑙嗛噹鍐呴笩缇ょ殑骞冲潎楂樺害(鍙傝€?
  // 銆愮 8 杞慨姝ｂ憿銆戜簯鍥㈠帤 250px 鏃? 鎸?骞冲潎楂樺害"淇啿鍑犱箮鎾炰笉涓?鍚冨垽鏄?9px 鐨?3D 鐞?銆?  // 鐪熷疄鐚涚鏄攣瀹?*鏌愪竴鍙?*鍐嶄刊鍐? 鎵€浠ヨ繖閲岄澶栫粰鍑洪攣瀹氫釜浣撶殑楂樺害; 鍐插埡/宸¤埅閮戒紭鍏堢敤瀹冦€?  PC.lockZ = (lockIdx >= 0) ? Z[lockIdx] : PC.z;
  return PC;
}

// tryDash: 鍙戣捣鍐插埡銆傚甫 卤60掳 鏂瑰悜绾︽潫 鈥斺€?鐩爣蹇呴』鍦ㄥ綋鍓嶈埅鍚?60掳 浠ュ唴,
// 鍚﹀垯鏀惧純骞惰繑鍥?false(鐩樻棆杞悜浼氶€愭笎瀵归綈, 杩欐槸鐗规€т笉鏄?bug)銆?// lockIdx: D 鐨勮糠鎯戞晥搴?鈥斺€?鍐插埡閿佸畾鐨勬楦熺储寮?闆?瀵规墜浼?-1, 涓嶇畻閿佸畾)銆?function tryDash(f, tx, ty, lockIdx, tz) {       // 绗?8 杞? 鍗囩淮鎴?3D(閲嶅姏鐗堣埅鍚戝す瑙?
  const dx = minImageX(tx - f.x), dy = minImageY(ty - f.y);
  const dz = GRAV_ON ? ((tz === undefined ? f.z : tz) - f.z) : 0;   // 瀹堟亽绾夸慨琛? 鍏抽噸鍔涘繀椤婚€€鍖栦负 2D(dz=0)
  const n = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (n <= 1) return false;
  const cvx = f.vx, cvy = f.vy, cvz = GRAV_ON ? f.vz : 0;
  const cn = Math.sqrt(cvx * cvx + cvy * cvy + cvz * cvz) || 1;
  const cosA = (cvx * dx + cvy * dy + cvz * dz) / (cn * n);
  // 銆恡ask-3銆戜刊鍐叉斁瀹? 鍘熸潵鐨?60掳 鏄?2D 鑸悜绾︽潫"鐨勪笁缁寸洿璇?鈥斺€?姘村钩鐩樻棆鐨勯拱闅?  // 鍙鐚庣墿鍦ㄦ涓嬫柟, 涓夌淮澶硅灏辫秼杩?90掳, 鏄庢槑璇ユ墤涓嬪幓鍗磋鍒や笉鍚堟牸(瀹炴祴鎴愬姛鍐插埡鐨?  // 澶硅 P90=57.5掳 宸茬粡璐寸潃涓婇檺, 澶ч噺"钀界┖(鑸悜澶硅杩囧ぇ)"灏辨槸杩欐牱鏉ョ殑)銆?  // 杩欓噷淇濈暀 60掳 甯歌閿? 浣嗗"鐩爣鍦ㄤ笅鏂?鐨勪刊鍐插彟澶栫粰 80掳 涓婇檺(娓搁毤鐨?stoop 鏄瀭鐩存満鍔?
  // 涓嶆槸姘村钩鎬ヨ浆寮?; 鍏抽噸鍔涙椂 dz=0 -> 鍒ゅ畾涓?2D 鐗堥€愪綅涓€鑷淬€?  if (cosA < Math.cos(DASH_MAX_ANGLE) && !(GRAV_ON && dz < 0 && cosA >= Math.cos(DASH_MAX_ANGLE_V))) return false;
  f.vx = dx / n * DASH_SPEED;
  f.vy = dy / n * DASH_SPEED;
  f.vz = dz / n * DASH_SPEED;
  f.dashT = Math.floor((Math.min(n, DASH_MAX_DIST) + DASH_EXTRA) / DASH_SPEED);
  f.shock = { x: tx, y: ty, z: f.z, t: 0 };      // 鍐插埡鐬棿鐨勫啿鍑绘尝(甯﹂珮搴?
  f.dashEats = 0;                                // A: 鏈鍐插埡鐨勭寧鐗╄鏁版竻闆?  f.dashS = 0;                                   // P1: 鏈鍐插埡鍚冨埌鐨勬楦熸暟(楠屾敹鐢?
  f.lockIdx = (DASH_LOCK && lockIdx !== undefined) ? lockIdx : -1;
  if (f.lockIdx >= 0) stats.lockedDashes++;
  return true;
}
/* task-3: 鍓嶇疆鐬勫噯鐐?澶嶇敤瀵硅薄, 涓嶅湪鐑矾寰勫垎閰?銆? * 涓€闃舵嫤鎴В: 姹?t 浣?|r + v路t| = DASH_SPEED路t (r = 鐚庣墿鐩稿浣嶇疆, v = 鐚庣墿閫熷害)銆? * 鐚庣墿 3.6px/甯?< 闅?8.5px/甯? 浜屾鏂圭▼蹇呮湁姝ｆ牴; 鍙彇"杩庨潰鎷︽埅"閭ｄ釜鏍广€? * 姣?鎸夊綋鍓嶈窛绂荤嚎鎬у墠缃?鏇村噯: 杩介€冩椂璺濈鏄敹缂╃殑, 鍒拌揪鏃堕棿姣?d/S 闀裤€?*/
const AIM = { x: 0, y: 0, z: 0, d: 0 };
function lockAim(f, pc) {
  const i = pc.lockIdx;
  const rx = minImageX(P[2 * i] - f.x), ry = minImageY(P[2 * i + 1] - f.y);
  const vx = V[2 * i], vy = V[2 * i + 1];
  AIM.d = Math.sqrt(rx * rx + ry * ry);                            // 鍒伴攣瀹氫釜浣撶殑姘村钩璺濈(鍑烘墜闂ㄩ檺鐢ㄥ畠)
  let t = AIM.d / DASH_SPEED;
  const qa = vx * vx + vy * vy - DASH_SPEED * DASH_SPEED;          // 鎭?< 0
  if (qa < -1e-9) {
    const qb = 2 * (rx * vx + ry * vy), qc = rx * rx + ry * ry;
    const disc = qb * qb - 4 * qa * qc;
    if (disc > 0) { const t2 = (-qb - Math.sqrt(disc)) / (2 * qa); if (t2 > 0) t = t2; }
  }
  t = Math.min(t, DASH_MAX_LEAD_T) * DASH_LEAD;
  AIM.x = wrapX(P[2 * i] + vx * t);
  AIM.y = wrapY(P[2 * i + 1] + vy * t);
  AIM.z = GRAV_ON ? Z[i] + VZ[i] * t : pc.lockZ;
  return AIM;
}
/* task-3: 瀵圭寧鐗╁彂璧峰啿鍒恒€? * 鈶?鍑烘墜闂ㄩ檺: 閿佸畾鐩爣杩樺湪 DASH_ENGAGE_R 涔嬪灏变笉鍐?鈥斺€?鍚冨垽鍗婂緞鍙湁 9px, 浠?300px 澶? *    鐩寸嚎鍐茶繃鍘荤寧鐗╂湁 30 甯ф椂闂磋窇鎺? 杩欐鏄?90% 鐨勫啿鍒轰粈涔堜篃鍚冧笉鍒?鐨勪富鍥?
 *    閫艰繎鍒伴棬闄愬唴鍐嶅嚭鎵? 鍐插埡娆℃暟灏戜簡, 浣嗘瘡娆￠兘鏈夋満浼氥€? * 鈶?鐬勫噯鐐? 閿佸畾涓綋(鎸夋嫤鎴В鍓嶇疆), 澶硅涓嶅悎鏍煎啀閫€鍥炴崬鍕轰腑蹇冦€? *    D 閿佸畾鏈熼棿鍙悆寰楀埌琚攣瀹氶偅涓€鍙? 鑰屾崬鍕轰腑蹇冪瀹冩渶澶?LOCK_R=40px(杩滃ぇ浜?9px 鍒ゅ畾鍦?,
 *    鎵€浠?鐬勪腑蹇?鏈潵灏卞亸銆?*/
function dashAtPrey(f, pc) {
  if (pc.cx < 0) return false;
  if (pc.lockIdx >= 0) {
    const a = lockAim(f, pc);
    if (a.d > DASH_ENGAGE_R) return false;
    if (tryDash(f, a.x, a.y, pc.lockIdx, a.z)) return true;
  }
  return tryDash(f, pc.cx, pc.cy, pc.lockIdx, pc.lockZ);
}
/* task-3: 鍐插埡缁撴潫鍚庣殑鎭㈠鏈?鈥斺€?鍩虹嚎 卤FALCON_REST_LO..HI 鐨勭鏈夐殢鏈哄€嶆暟 + 鐤插姵椤广€?*/
function falconRest(f) {
  f.rng = (Math.imul(f.rng, 1664525) + 1013904223) >>> 0;
  const u = f.rng / 4294967296;
  const jit = CIRCLE_FRAMES * (FALCON_REST_LO + (FALCON_REST_HI - FALCON_REST_LO) * u);
  const fat = (1 - f.energy / ENERGY_MAX) * FALCON_REST_FATIGUE;   // 鍐插埡鑰楀緱瓒婄嫚, 姝囧緱瓒婁箙
  return Math.max(20, Math.round(jit + fat));
}

/* ------------------------------ 6. 浠跨湡 step ------------------------------ */

let migAng = Math.random() * TAU;          // 缇や綋杩佸緳鏂瑰悜(缂撴參闅忔満娓稿姩)

/* ---- W2 鎯婇娉㈢姸鎬?瀹氬瀷鏁扮粍, 闆跺垎閰? ----
 * W2_ALERT: >0 琛ㄧず璇ラ笩姝ｅ浜?鎬ヨ浆璀︽姤"涓?鍓╀綑甯ф暟); W2_TURN: 涓婁竴甯х殑甯︾鍙疯浆鍚?寮у害/甯?銆? * 鏀惧湪杩欓噷(鑰屼笉鏄缇ょ姸鎬佸尯)鏄负浜嗘妸 W2 鐨勬敼鍔ㄥ眬闄愬湪楦熺兢鍙楀姏/绉垎杩欎竴鍧椼€?*/
const W2_ALERT = new Float32Array(MAXN).fill(-REFRACT);   // 鍒濆€?= 寰呭懡(涓嶆槸 0=璀︽姤)
const W2_TURN  = new Float32Array(MAXN);

/* step():
 *   6.1+6.2 缃戞牸涓庢嫇鎵戦偦灞?鍙€?GPU 鈥斺€?瑙佹枃浠舵湯灏?WebGPU 璁＄畻鍚庣)
 *   + 6.3~6.10 鍏朵綑绯荤粺(姘镐箙鐣?CPU: 闆?鐚涚/瀛︿範/浜嬩欢)
 * CPU 璺緞涓庢棫鐗堥€愯鍚屾瀯(浣嶇骇涓€鑷? 瑙?_checks/golden.mjs)銆?*/
let cxmI = W / 2, cymI = H / 2;              // 6.1/6.2 浜у嚭鐨勫叏灞€璐ㄥ績, 渚?6.3/6.4 鐢?function step() {
  frame++; stats.steps++;
  const tor = TORUS;                         // 姣忔鍙栦竴娆? 鐑惊鐜噷涓嶅啀鍙嶅鏌ュ叏灞€
  cpuGridAndForces(tor);                     // 6.1 + 6.2(CPU 鍙傝€冨疄鐜?
  stepRest(tor);                             // 6.3 ~ 6.10
}

/* ---- 6.1 + 6.2(CPU 鍙傝€冨疄鐜? GPU 鐗堣鏂囨湯 ComputeBackend 鐨勫悓鏋?WGSL) ---- */
function cpuGridAndForces(tor) {
  /* ---- 6.1 閲嶅缓缃戞牸(鍙娲绘楦? 閾捐〃姹犲寲, 闆跺垎閰? ----
   * 閾捐〃鏄ご鎻掓硶(妗跺唴闄嶅簭), 浣?*閬嶅巻椤哄簭蹇呴』涓庢棫鐗堥€愪綅涓€鑷?*, 鍚﹀垯娴偣姹傚拰
   * 椤哄簭鍙樹簡銆佹贩娌岀郴缁熶細鏀惧ぇ鎴愬畬鍏ㄤ笉鍚岀殑杞ㄨ抗: 鎵€浠ラ澶栬浣?妗剁殑棣栨鍑虹幇椤哄簭"
   * (cellOrder)骞跺湪閬嶅巻鏃舵妸閾鹃€嗘垚鍗囧簭(chainBuf) 鈥斺€?浣嶇骇澶嶇幇鏃?Map+鏁扮粍鐨勮涓恒€?*/
  gridHead.fill(-1);
  cellOrderN = 0;
  for (let i = 0; i < N; i++) {
    if (!alive[i]) continue;
    const c = cellOf(P[2*i], P[2*i+1]);
    if (gridHead[c] === -1) cellOrder[cellOrderN++] = c;
    gridNext[i] = gridHead[c];               // 澶存彃娉? i 鎴愪负璇ユ《鏂扮殑閾惧ご
    gridHead[c] = i;
  }
  for (const f of threats) f.mob = 0;        // C: 鍥存敾璁℃暟姣忓抚娓呴浂, 鏈抚閲嶆柊缁熻

  /* ---- 6.2 妞嬮笩: 鎷撴墤閭诲眳鎵弿(鍙畻鍔? + 鍏ㄥ眬璐ㄥ績绱姞 ---- */
  let sumX = 0, sumY = 0, cntAlive = 0;
  let sXc = 0, cXc = 0, sYc = 0, cYc = 0;

  for (let i = 0; i < N; i++) {
    if (!alive[i]) continue;
    const xi = P[2*i], yi = P[2*i+1];
    const cx = clamp(Math.floor((xi + PAD) / CELL), 0, GW - 1);
    const cy = clamp(Math.floor((yi + PAD) / CELL), 0, GH - 1);

    // 鏀堕泦鍊欓€? 鍙繚鐣欐渶杩戠殑 topoK 鍙?鎷撴墤閭诲眳; A 鐗堢殑鏍稿績)銆?    // 妲戒綅鎸夎窛绂诲崌搴忕淮鎶? 姣?姣忔閲嶆壂鏈€杩滄Ы"灏戜竴涓?O(K) 鍐呭眰寰幆,
    // 澶у鏁板€欓€夊彧闇€涓€娆℃瘮杈?KD[kn-1] 灏辫涓㈡帀銆?    let kn = 0;
    for (let ox = -1; ox <= 1; ox++)
      for (let oy = -1; oy <= 1; oy++) {
        let gx = cx + ox, gy = cy + oy;
        if (tor) { gx = ((gx % GW) + GW) % GW; gy = ((gy % GH) + GH) % GH; }
        else if (gx < 0 || gx >= GW || gy < 0 || gy >= GH) continue;
        for (let j = gridHead[gy * GW + gx]; j !== -1; j = gridNext[j]) {
          if (j === i) continue;
          const dx = tor ? minImageX(P[2*j] - xi) : P[2*j] - xi;
          const dy = tor ? minImageY(P[2*j+1] - yi) : P[2*j+1] - yi;
          const d2 = dx * dx + dy * dy;
          if (d2 > PERCEPTION_R2) continue;
          let p;
          if (kn < topoK) p = kn++;            // 鍏堝～婊?K 涓Ы
          else if (d2 < KD[kn-1]) p = kn - 1;  // 姣斿綋鍓嶆渶杩滅殑杩樿繎 -> 椤舵帀瀹?          else continue;
          while (p > 0 && KD[p-1] > d2) {      // 鍐掓场鍒版纭綅缃? 缁存寔鍗囧簭
            KD[p] = KD[p-1]; KX[p] = KX[p-1]; KY[p] = KY[p-1]; KJ[p] = KJ[p-1];
            p--;
          }
          KD[p] = d2; KX[p] = dx; KY[p] = dy; KJ[p] = j;
        }
      }

    /* ---- W2 娑岀幇澧炲己: 瀵归綈 / 鍑濊仛 / 鍒嗙 鍚勮嚜鐙珛鎴愬姏(涓嶅啀鍏堟贩鎴愪竴涓柟鍚戝啀褰掍竴鍖? ----
     * 涓轰粈涔? 鏃у啓娉曟妸 鍑濊仛(閭诲眳浣嶇疆鍜? 涓?瀵归綈(閭诲眳閫熷害鍜? 鍏堢浉鍔犲啀褰掍竴鍖? 寰楀埌涓€涓?     * "鎶樹腑鏂瑰悜"; 瀵归綈鐨勬潈閲嶈鍑濊仛鐨勮窛绂婚」鍚炴帀, 缇や綋鍙兘闈?鎸ゆ垚涓€鍧?缁存寔涓€鑷?鈥斺€?     * 瀹忚涓婂氨鏄竴鍧楀垰鎬у疄浣? 鎯婇淇″彿浼犱笉鍑?flee 鍗婂緞(瀹炴祴 100~150px 涔嬪悗楠ら檷)銆?     * 鏂板啓娉?
     *   鈶?瀵归綈鐢?*閭诲眳鍗曚綅鑸悜鐨勫钩鍧?*(涓嶇湅閭诲眳蹇參, 涔熶笉琚參楦熸嫋鍋?, 鍗曠嫭缁欓绠?ALIGNMENT_W;
     *   鈶?鍑濊仛鍗曠嫭缁欓绠?COHESION_W, 鐩爣鏄?閭诲眳璐ㄥ績鏂瑰悜";
     *   鈶?鍒嗙娌跨敤璺濈鍔犳潈(瓒婅繎鎺ㄥ緱瓒婄嫚);
     *   鈶?鍚勫悜寮傛€?ANISO: 渚у墠鏂圭殑閭诲眳鏉冮噸鏇撮珮(妞嬮笩瑙嗛噹鏈夌洸鍖? 鐪熷疄缇ょ殑杞悜鏄?浠庡墠寰€鍚?浼?;
     *   鈶?鍏ㄧ▼闆跺垎閰? 鍙敤鏍堜笂鏍囬噺涓庡凡澶嶇敤鐨?KX/KY/KD/KJ 妲姐€?     * 姣忛」鍏堝綊涓€鍖栨柟鍚戝啀 clamp 鍒拌嚜宸遍绠? 鎵€浠ラ偦灞呭啀澶氥€佽窛绂诲啀杩滀篃涓嶄細鐖嗘帀銆?*/
    let ax = 0, ay = 0;
    let relay = 0;                                             // 閭诲眳"鎬ヨ浆"鐨勫甫绗﹀彿鍜?鎯婇娉㈡柟鍚?
    if (kn > 0) {
      const vix = V[2*i], viy = V[2*i+1];
      const spi = Math.sqrt(vix * vix + viy * viy);
      let pxn = 0, pyn = 0, uxn = 0, uyn = 0, sepx = 0, sepy = 0, wsum = 0;
      for (let m = 0; m < kn; m++) {
        const j = KJ[m];
        const vjx = V[2*j], vjy = V[2*j+1];
        const spj = Math.sqrt(vjx * vjx + vjy * vjy);
        // 鍚勫悜寮傛€? 閭诲眳鍦ㄦ垜姝ｅ墠鏂?-> 鏉冮噸 1+ANISO; 姝ｅ悗鏂?-> 1-ANISO(涓嬮檺 0.1)
        let w = 1;
        if (ANISO > 0 && spi > 1e-6) {
          const dl = Math.sqrt(KD[m]);
          if (dl > 1e-6) w += ANISO * (vix * KX[m] + viy * KY[m]) / (spi * dl);
          if (w < 0.1) w = 0.1;
        }
        wsum += w;
        pxn += KX[m] * w; pyn += KY[m] * w;                     // 鍑濊仛: 閭诲眳璐ㄥ績(鍔犳潈)
        if (spj > 1e-9) { uxn += vjx / spj * w; uyn += vjy / spj * w; }   // 瀵归綈: 鍗曚綅鑸悜(鍔犳潈)
        if (KD[m] < SEP_R2) {                                   // 鍒嗙: 璺濈鍔犳潈鎺ㄥ紑
          const wd = 1 / Math.max(KD[m], 1);
          sepx -= KX[m] * wd; sepy -= KY[m] * wd;
        }
        relay += (W2_ALERT[j] > 0.5) ? W2_TURN[j] : 0;   // 鎯婇娉? 閭诲眳鐨?鎬ヨ浆"甯︾鍙风疮鍔?      }
      const inv = 1 / Math.max(wsum, 1e-9);
      pxn *= inv; pyn *= inv; uxn *= inv; uyn *= inv;
      const pn = Math.sqrt(pxn * pxn + pyn * pyn);
      if (pn > 1e-9) {                                          // 鍑濊仛鍔?鏂瑰悜 -> 鏈熸湜閫熷害 -> 鍙楅檺杞悜)
        const tx2 = pxn / pn * MAX_SPEED, ty2 = pyn / pn * MAX_SPEED;
        ax += clamp((tx2 - vix) * COHESION_W, -MAX_FORCE * COHESION_W, MAX_FORCE * COHESION_W);
        ay += clamp((ty2 - viy) * COHESION_W, -MAX_FORCE * COHESION_W, MAX_FORCE * COHESION_W);
      }
      const un = Math.sqrt(uxn * uxn + uyn * uyn);
      if (un > 1e-9) {                                          // 瀵归綈鍔?鐙珛鐨勮浆鍚戦绠?
        const tx2 = uxn / un * MAX_SPEED, ty2 = uyn / un * MAX_SPEED;
        ax += clamp((tx2 - vix) * ALIGNMENT_W, -MAX_FORCE * ALIGNMENT_W, MAX_FORCE * ALIGNMENT_W);
        ay += clamp((ty2 - viy) * ALIGNMENT_W, -MAX_FORCE * ALIGNMENT_W, MAX_FORCE * ALIGNMENT_W);
      }
      ax += clamp(sepx * SEP_GAIN, -2 * MAX_FORCE, 2 * MAX_FORCE);   // 鍒嗙鍔?鍏佽鏇村ぇ棰勭畻)
      ay += clamp(sepy * SEP_GAIN, -2 * MAX_FORCE, 2 * MAX_FORCE);

      // 鈶?鎯婇娉紶鏌? 閭诲眳姝ｅ湪鎬ヨ浆 -> 鎴戞湞**鍚屼竴鏂瑰悜**鎬ヨ浆(鐓ф妱鍔ㄤ綔, 涓嶆槸鍚戝钩鍧囪埅鍚戦潬鎷?銆?      //    鍙潬瀵归綈鏄潎鍊煎洖褰? 琚悡鍒扮殑涓綋浼氳閭诲眳鎷夊洖鍏辫瘑, 娉㈢┛涓嶈繃鍑犱釜韬綅銆?      if (Math.abs(relay) > RELAY_MIN && spi > 1e-6) {
        const s = relay > 0 ? 1 : -1;
        const mag = Math.min(1, Math.abs(relay)) * CONT_W * MAX_FORCE * MAX_SPEED;
        ax += -s * viy / spi * mag;                       // 宸﹁浆 = 閫熷害閫嗘椂閽?90掳(-vy, +vx)
        ay += s * vix / spi * mag;
      }
    }
    /* 浼犳煋鐘舵€佹満(鍙叴濂嬩粙璐ㄧ殑涓€娆℃€ф尝): a>0 = 姝ｅ湪鎬ヨ浆(璀︽姤涓?; a<0 = 涓嶅簲鏈? a=-REFRACT = 寰呭懡銆?     * 涓轰粈涔堣鏈変笉搴旀湡: 娌℃湁瀹? 涓ゅ彧楦熶細浜掔浉鎺ュ姏鎶?璀︽姤"姘镐箙缁存寔涓嬪幓 鈥斺€?鏁寸兢浼氫竴鐩存墦杞€?*/
    { const a0 = W2_ALERT[i];
      if (a0 > 0) W2_ALERT[i] = a0 - 1;
      else if (a0 <= -REFRACT && Math.abs(relay) > RELAY_MIN) W2_ALERT[i] = ALERT_FRAMES;
      else if (a0 > -REFRACT) W2_ALERT[i] = a0 - 1; }
    ACC[2*i] = ax; ACC[2*i+1] = ay;

    sumX += xi; sumY += yi; cntAlive++;
    if (tor) {                                 // 鐜潰璐ㄥ績璧板渾鍧囧€?      sXc += Math.sin(xi / W * TAU); cXc += Math.cos(xi / W * TAU);
      sYc += Math.sin(yi / H * TAU); cYc += Math.cos(yi / H * TAU);
    }
  }

  cxmI = cntAlive === 0 ? W / 2
       : (tor ? wrapX(Math.atan2(sXc, cXc) / TAU * W) : sumX / cntAlive);
  cymI = cntAlive === 0 ? H / 2
       : (tor ? wrapY(Math.atan2(sYc, cYc) / TAU * H) : sumY / cntAlive);
}

/* ---- 鍙畻鍏ㄥ眬璐ㄥ績(GPU 璺緞涓?6.1/6.2 鍦?GPU 涓婅窇, 浣?6.3/6.4 浠嶉渶瑕佽川蹇? ----
 * 涓?cpuGridAndForces 閲岄偅娈电疮鍔犲畬鍏ㄥ悓搴?閫愰笩 i 鍗囧簭), 鎵€浠ョ粨鏋滈€愪綅涓€鑷淬€?*/
function cpuCentroidOnly(tor) {
  let sumX = 0, sumY = 0, cnt = 0, sXc = 0, cXc = 0, sYc = 0, cYc = 0;
  for (let i = 0; i < N; i++) {
    if (!alive[i]) continue;
    const xi = P[2*i], yi = P[2*i+1];
    sumX += xi; sumY += yi; cnt++;
    if (tor) {
      sXc += Math.sin(xi / W * TAU); cXc += Math.cos(xi / W * TAU);
      sYc += Math.sin(yi / H * TAU); cYc += Math.cos(yi / H * TAU);
    }
  }
  cxmI = cnt === 0 ? W / 2 : (tor ? wrapX(Math.atan2(sXc, cXc) / TAU * W) : sumX / cnt);
  cymI = cnt === 0 ? H / 2 : (tor ? wrapY(Math.atan2(sYc, cYc) / TAU * H) : sumY / cnt);
}

/* ---- 6.3 ~ 6.10(姘镐箙鐣?CPU) ---- */
function stepRest(tor) {
  /* 绗?8 杞? 缇や綋鍧囬珮(瀹氶珮寮圭哀鐢? O(N) 涓€閬嶈繃; 涓?xy 瀹屽叏瑙ｈ€?-> 2D 杞ㄨ抗閫愪綅涓嶅彉) */
  let zSum = 0, zCnt = 0, zLo = 1e9, zHi = -1e9;
  for (let i = 0; i < N; i++) if (alive[i]) {
    zSum += Z[i]; zCnt++;
    if (Z[i] < zLo) zLo = Z[i];
    if (Z[i] > zHi) zHi = Z[i];
  }
  const zMean = zCnt ? zSum / zCnt : Z_INIT;
  zMeanLive = zMean;
  if (zCnt) { zLowLive = zLo; zHighLive = Math.max(zHi, zLo + 30); }   // 涓夌淮浜害鏄犲皠鐢?
  /* ---- 6.3 杩佸緳鏂瑰悜: 闅忔満娓稿姩 + 绂诲睆澶繙灏辨幇鍥炴潵 ---- */
  migAng += (Math.random() - 0.5) * 0.025;
  const offX = tor ? minImageX(W / 2 - cxmI) : W / 2 - cxmI;
  const offY = tor ? minImageY(H / 2 - cymI) : H / 2 - cymI;
  if (Math.sqrt(offX * offX + offY * offY) > 150) {
    migAng += angDiff(Math.atan2(offY, offX), migAng) * 0.02;
  }
  const migX = Math.cos(migAng) * MIGRATE_FORCE;
  const migY = Math.sin(migAng) * MIGRATE_FORCE;

  /* ---- 6.4 妞嬮笩: 绉垎(璐ㄥ績寮曞姏 + 杩佸緳 + 杈圭晫 + 琚崟椋?+ 閫冮€? ---- */
  for (let i = 0; i < N; i++) {
    if (!alive[i]) continue;
    const xi = P[2*i], yi = P[2*i+1];
    const vi = 2 * i;
    let ax = ACC[vi], ay = ACC[vi+1];
    let az = 0;                            // 绗?8 杞? 鍨傜洿鏂瑰悜鍔?閫冮€?寮圭哀/閲嶅姏)

    const dcx = tor ? minImageX(cxmI - xi) : cxmI - xi;
    const dcy = tor ? minImageY(cymI - yi) : cymI - yi;
    const dn = Math.sqrt(dcx * dcx + dcy * dcy);   // 寮辫川蹇冨紩鍔? 鍙槻姘镐箙纰庤
    if (dn > 1e-9) { ax += dcx / dn * CENTROID_FORCE; ay += dcy / dn * CENTROID_FORCE; }

    ax += migX; ay += migY;

    if (!tor) {                                // 銆愮 8 杞慨姝ｂ懃銆戣竟鐣屽帉鎭跺姏(涓嶆槸澧?
      const bd = boundAccel(xi, yi, V[vi], V[vi + 1], 0);
      if (bd) {
        const pen = bd[2];
        const F = BOUND_FORCE * pen * pen * 9;
        ax += bd[0] * F; ay += bd[1] * F;
        const vOut = V[vi] * bd[0] + V[vi + 1] * bd[1];
        if (vOut < 0) { const cut = -vOut * 0.35 * pen; ax += bd[0] * cut; ay += bd[1] * cut; }
      }
    }

    let eaten = false;                         // 琚崟椋? 鎾炰笂浠绘剰鐚涚鍗虫秷澶?    for (let t = 0; t < threats.length; t++) {
      const f = threats[t];
      // D 杩锋儜鏁堝簲: 鍐插埡閿佸畾鏌愬彧楦熸椂, 鍐插埡鏈熼棿鍙悆寰楀埌琚攣瀹氱殑閭ｄ竴鍙?      if (f.dashT > 0 && f.lockIdx >= 0 && f.lockIdx !== i) continue;
      const ex = tor ? minImageX(xi - f.x) : xi - f.x;
      const ey = tor ? minImageY(yi - f.y) : yi - f.y;
      const ez = (GRAV_ON && EAT_3D) ? Z[i] - f.z : 0;                  // 绗?8 杞? 3D 鍒ゅ畾鐞?      if (ex * ex + ey * ey + ez * ez < EAT_R2_S) {
        f.score += SCORE_STARLING; f.pending += SCORE_STARLING; f.kills++;
        if (f.dashT > 0) { f.dashEats++; f.dashS++; }   // A: 鍚冨埌涓滆タ / P1 楠屾敹鍙暟妞嬮笩
        if (f.kind === "eagle") f.dietStarling++;
        stats.kills++;
        alive[i] = 0; aliveCount--;
        addDeath(xi, yi);
        if (GRAV_ON) spawnCorpse(xi, yi, Z[i], V[vi], V[vi+1], VZ[i]);   // 绗?8 杞? 灏镐綋涓嬪潬
        eaten = true;
        break;
      }
    }
    if (eaten) continue;

    for (let t = 0; t < threats.length; t++) {  // 閫冮€? 瑙嗛噹鍐呮墍鏈夌寷绂介兘鐢熸晥
      const f = threats[t];
      const dpx = tor ? minImageX(xi - f.x) : xi - f.x;
      const dpy = tor ? minImageY(yi - f.y) : yi - f.y;
      const dp2 = dpx * dpx + dpy * dpy;
      if (dp2 < FLEE_R2 && dp2 > 0) {
        const dp = Math.sqrt(dp2);
        ax += FLEE_W * clamp(dpx / dp * MAX_SPEED - V[vi],   -FLEE_FORCE, FLEE_FORCE);
        ay += FLEE_W * clamp(dpy / dp * MAX_SPEED - V[vi+1], -FLEE_FORCE, FLEE_FORCE);
        if (GRAV_ON) {                       // 绗?8 杞? 涓夌淮閫冮€?鈥斺€?楂樹簬鐚涚寰€涓婇, 浣庝簬寰€涓嬮捇
          const dz2 = Z[i] - f.z;
          az += clamp(-dz2 / dp * 1.6 - VZ[i], -0.35, 0.35);
        }
      }
    }

    // C 鍥存敾: 鍥存敾鑰呴€艰繎鐚涚鍒伴獨鎵扮幆 鈥斺€?鐜寰€閲屽帇, 鐜唴寰€澶栨帹, 楦熺兢鍥寸潃鐚涚杞?    if (isMobber[i]) {
      let mf = null, md2 = 1e18, mdx = 0, mdy = 0;
      for (let t = 0; t < threats.length; t++) {
        const f = threats[t];
        const dx = tor ? minImageX(xi - f.x) : xi - f.x;
        const dy = tor ? minImageY(yi - f.y) : yi - f.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < md2) { md2 = d2; mf = f; mdx = dx; mdy = dy; }
      }
      const md = Math.sqrt(md2);
      if (mf && md < MOB_R && md > 1e-6) {
        mf.mob++;                              // 鏈抚琚繖鍙笩鍥翠綇
        const ux = mdx / md, uy = mdy / md;    // u = "鐚涚鎸囧悜楦?鐨勫崟浣嶅悜閲?        const push = (md - MOB_HARASS) / MOB_HARASS;
        const tx2 = -ux * push * MAX_SPEED * 1.5;
        const ty2 = -uy * push * MAX_SPEED * 1.5;
        ax += clamp(tx2 - V[vi],   -MOB_MAX, MOB_MAX);
        ay += clamp(ty2 - V[vi+1], -MOB_MAX, MOB_MAX);
      }
    }

    let vx = V[vi] + ax, vy = V[vi+1] + ay;
    const sp = Math.sqrt(vx * vx + vy * vy);
    if (sp > MAX_SPEED) { vx = vx / sp * MAX_SPEED; vy = vy / sp * MAX_SPEED; }
    V[vi] = vx; V[vi+1] = vy;
    P[vi]   = wrapX(xi + vx);
    P[vi+1] = wrapY(yi + vy);

    // 绗?8 杞?z 杞? 閲嶅姏 - 瀹氶珮寮圭哀(鏈濅釜浜洪琛屽眰) + 杩戝湴鎺ㄥ崌 + 閫冮€稿瀭鐩村垎閲?+ 闃诲凹銆?    // xy 鍔ㄥ姏瀛︿笉鍙楀奖鍝?-> 閲嶅姏鍏虫帀鏃朵笌鏃х増閫愪綅涓€鑷淬€?    if (GRAV_ON) {
      // 銆愮 8 杞慨姝ｃ€戝師鏉ュ脊绨ф湞"鍏变韩鐨勭兢浣撳潎楂?涓旀棤闃诲凹, 閫犳垚涓や釜鍙姣涚梾:
      //   鈶?鍧囧€煎洖褰掓妸鐩稿鍋忓樊鍚冩帀 -> 浜戝洟鎱㈡參濉屾垚涓€灞?瀹炴祴 z 鏍囧噯宸?21 -> 4, 鐪嬭捣鏉?鍏ㄥ湪涓€涓钩闈?);
      //   鈶?vz 鏃犻樆灏?-> 姣忓彧楦熶笂涓嬫棤浼戞鎸崱(瀹炴祴 |vz| 涓€鐩寸淮鎸?0.6px/甯?銆?      // 鐜板湪: 姣忓彧楦熸湁鑷繁鐨勯琛屽眰 ZT[i](鍘氬害姘镐箙淇濈暀) + 寮辩兢浣撹€﹀悎(鏁村洟浠嶄竴鑷?
      //       + 鍨傚悜闃诲凹 ALT_DAMP(鎶婃尟鑽″帇鎺?銆?      // 銆愮 8 杞慨姝ｂ憽銆戦笩瑕佽兘"涓诲姩"鏀瑰彉楂樺害, 涓嶇劧鍙槸琚噸鍔?寮圭哀鎽嗗竷, 鐪嬭捣鏉ヤ笉浼氱埇鍗?
      //   鈶?涓汉椋炶灞傜紦鎱㈡父璧?姣忓彧楦熻嚜宸辨寫楂樺害, 涓婁笅鑼冨洿 FLOOR+70 ~ Z_CEIL);
      //   鈶?鎯婇鐬棿鍚戜笂绐?鍙楁儕鐨勬楦熸槸寰€涓婄偢寮€鐨?銆?      ZT[i] = clamp(ZT[i] + (Math.random() - 0.5) * 0.12, FLOOR_Z + 70, Z_CEIL);
      if (startled[i] && VZ[i] < 1.2) VZ[i] += 0.55;
      let az2 = az - G_GRAV + (ZT[i] - Z[i]) * ALT_SPRING + (zMean - Z[i]) * ALT_SPRING * 0.25;
      if (Z[i] < FLOOR_Z + 50) az2 += FLOOR_PUSH;
      VZ[i] = clamp(VZ[i] * ALT_DAMP + az2, -3.2, 3.2);
      Z[i] = Math.max(FLOOR_Z, Z[i] + VZ[i]);
    }

    // P4 鎯婇鍒ゆ嵁: **蹇呴』鏀惧湪杩欓噷** 鈥斺€?浣嶇疆/閫熷害宸茬粡鏇存柊, 杩樻病瑕嗙洊 PV銆?    // 鍒ゆ嵁鏄?鐩搁偦涓ゅ抚閫熷害澶硅 > 60掳"(鎬ヨ浆, 涓嶆槸蹇參: 妞嬮笩骞虫椂涔熻创婊￠€?銆?    // 椤哄簭閿欎竴甯?鍏堣鐩?PV 鍐嶆瘮)浼氳鍏ㄤ綋浜掔浉鎷胯嚜宸辨瘮, 鍏ㄥ憳璇姤銆?    const pvx = PV[vi], pvy = PV[vi+1];
    const np = Math.sqrt(pvx * pvx + pvy * pvy);
    if (np > 1e-6 && sp > 1e-6) {
      startled[i] = ((vx * pvx + vy * pvy) / (sp * np) < PV_ALERT_COS) ? 1 : 0;
    } else startled[i] = 0;
    {   // W2 鎯婇娉? 璁颁笅鏈抚"甯︾鍙?鐨勮浆鍚?鈥斺€?娉㈡部缇や綋浼犳挱闈犵殑鏄収鎶勯偦灞呯殑杞悜,
      // 涓嶆槸闈犲悜閭诲眳鐨勫钩鍧囪埅鍚戞敹鏁?鍚庤€呮槸鍧囧€煎洖褰? 浼氭妸鎵板姩鎷夊钩)銆?      if (np > 1e-6 && sp > 1e-6) {
        const tOld = Math.atan2(pvy, pvx), tNew = Math.atan2(vy, vx);
        let dA = tNew - tOld;
        while (dA > Math.PI) dA -= TAU;
        while (dA < -Math.PI) dA += TAU;
        W2_TURN[i] = dA;
        if (Math.abs(dA) > ALERT_TRIG) W2_ALERT[i] = ALERT_FRAMES;   // 鑷繁鎬ヨ浆(琚寷绂藉悡鍒? -> 娉㈡簮
      } else W2_TURN[i] = 0;
    }
    PV[vi] = vx; PV[vi+1] = vy;
  }

  stepCorpses();                             // 绗?8 杞? 灏镐綋涓嬪潬(涓庨笩/闆佹棤鍏? O(甯搁噺))

  /* ---- 6.5 闆佺兢: 涓績鍖栫З搴?棰嗛槦鏅鸿兘 / 杞€?/ 骞奸泚鍐呴亾 / 濞佹厬閿?/ 鏂╅娣蜂贡)
   *   + 绗洓閮ㄥ垎: 鍊熸楦熺兢鐨勬儕椋炵綉鎻愬墠棰勮 ---- */

  // --- 杞€奸闃? 姣?ROTATE_FRAMES 鎹竴娆?apex; 铏氭嫙棰嗛槦浣嶇疆 = apex 闆佸綋鍓嶄綅缃?涓嶇灛绉?
  if (frame % ROTATE_FRAMES === 0) rotateLeader();
  if (disarray > 0) disarray--;
  if (gooseDebuff > 0) gooseDebuff--;
  Lx = P2[2*leaderIdx]; Ly = P2[2*leaderIdx+1];       // apex 鑷繁灏辨槸 V 灏?
  // --- 棰嗛槦鏅鸿兘(A): 鎰熺煡 400px 鍐呮渶杩戠寷绂?-> 闄愰€熻浆鍚戣繙绂? 鏃犲▉鑳佹椂闅忔満娓稿姩 + 鍚戝績
  let leaderHustle = 1;
  {
    let ld = 1e18, lx = 0, ly = 0;
    for (let t = 0; t < threats.length; t++) {
      const f = threats[t];
      const dx = minImageX(Lx - f.x), dy = minImageY(Ly - f.y);
      const d2 = dx * dx + dy * dy;
      if (d2 < ld) { ld = d2; lx = dx; ly = dy; }
    }
    const ld2 = Math.sqrt(ld);
    if (ld2 < LEADER_SENSE_R && ld2 > 1e-6) {
      const away = Math.atan2(ly, lx);                 // 杩滅鐚涚鐨勬柟鍚?      leaderAng += clamp(angDiff(away, leaderAng), -LEADER_MAX_TURN, LEADER_MAX_TURN);
    } else {
      leaderAng += (Math.random() - 0.5) * 0.02;       // 闅忔満娓稿姩
      const ox = minImageX(W / 2 - Lx), oy = minImageY(H / 2 - Ly);
      if (Math.hypot(ox, oy) > 300) leaderAng += angDiff(Math.atan2(oy, ox), leaderAng) * 0.015;
    }
    // 濞佽儊寰堣繎浜? 棰嗛槦甯﹀ご鍔犻€?闃熷舰涓嶅彉, 鍙槸鏁翠綋鎻愰€?
    if (ld2 < LEADER_PANIC_R) leaderHustle = ESCAPE_HUSTLE;
  }
  const lhx = Math.cos(leaderAng), lhy = Math.sin(leaderAng);
  const slotScale = (gooseDebuff > 0 ? DEBUFF_FACTOR : 1);

  // P2A 楠屾敹鍙栨牱(姣?30 甯?: 闆佸皷涓庢渶杩戦毤鐨勮窛绂?鈥斺€?棰嗛槦鏅鸿兘鏈夋病鏈夋妸闃熷舰甯﹀紑
  if (frame % 30 === 0 && galiveCount > 0) {
    let bd = 1e18;
    for (const f of falcons) {
      const dx = minImageX(Lx - f.x), dy = minImageY(Ly - f.y);
      const d2 = dx * dx + dy * dy;
      if (d2 < bd) bd = d2;
    }
    bd = Math.sqrt(bd);
    stats.apexDistSum += bd; stats.apexDistSamples++;
    if (bd < 300) stats.apexClose++;
  }

  for (let i = 0; i < M; i++) {
    if (!galive[i]) continue;
    const xi = P2[2*i], yi = P2[2*i+1];

    let nd = 1e18, nx = 0, ny = 0, nz = 0;     // 鏈€杩戠殑鐚涚(鍚拱)
    for (const f of threats) {
      const dx = minImageX(xi - f.x), dy = minImageY(yi - f.y);
      const d2 = dx * dx + dy * dy;
      if (d2 < nd) { nd = d2; nx = dx; ny = dy; nz = GRAV_ON ? f.z : 0; }
    }
    const d = Math.sqrt(nd);
    const raptorNear = d < FORMATION_BREAK && d > 0;
    const gooseFleeZ = () => {                 // 绗?8 杞? 涓夌淮閫冮€哥殑鍨傜洿鍒嗛噺(娣蜂贡/璁╀綅涓ゅ澶嶇敤)
      if (GRAV_ON) VZ2[i] += clamp((Z2[i] - nz) / Math.max(1, d) * 1.5 - VZ2[i], -0.25, 0.25);
    };

    // --- P4 鍊熺綉棰勮: 鏌ュ懆杈?3脳3 妗堕噷 140px 鍐呯殑鎯婇妞嬮笩, >=3 鍙鍚岀寷绂介€艰繎
    let alert = false, alx = 0, aly = 0, aln = 0;
    {
      const cx = clamp(Math.floor((xi + PAD) / CELL), 0, GW - 1);
      const cy = clamp(Math.floor((yi + PAD) / CELL), 0, GH - 1);
        for (let ox = -1; ox <= 1; ox++)
        for (let oy = -1; oy <= 1; oy++) {
          let gx = cx + ox, gy = cy + oy;
          if (TORUS) { gx = ((gx % GW) + GW) % GW; gy = ((gy % GH) + GH) % GH; }
          else if (gx < 0 || gx >= GW || gy < 0 || gy >= GH) continue;
          const c2 = gy * GW + gx;
          let m = 0;                                          // 閫嗛摼鎴愬崌搴?涓庢棫鐗堝悓搴?
          for (let j = gridHead[c2]; j !== -1; j = gridNext[j]) chainBuf[m++] = j;
          for (let q = m - 1; q >= 0; q--) {
            const j = chainBuf[q];
            if (!startled[j]) continue;
            const dx = minImageX(P[2*j] - xi), dy = minImageY(P[2*j+1] - yi);
            if (dx * dx + dy * dy > ALERT_R2) continue;
            aln++; alx += V[2*j]; aly += V[2*j+1];      // 璺熸祦: 鎯婇楦熺殑骞冲潎閫熷害鏂瑰悜
          }
        }
      if (aln >= ALERT_N) {
        alert = true;
        stats.gooseAlerts++;
        // 闄勮繎 400px 鍐呮病鏈夌寷绂藉嵈鎶ヨ = 璇姤(娑岀幇浠ｄ环: 妞嬮笩缈绘粴涔熶細瑙﹀彂)
        if (d > ALERT_FALSE_R) stats.gooseFalseAlerts++;
      }
    }

    let ax = 0, ay = 0;
    if (disarray > 0) {
      gooseFleeZ();                            // 绗?8 杞?      // E 鏂╅娣蜂贡鏈? 妲戒綅鍔涘叧闂? 鍏ㄤ綋閫€鍖栦负涓綋寰勫悜閫冮€?澶嶇敤閫冮€歌矾寰?
      if (d > 1e-6) {
        ax += FLEE_W * 1.2 * clamp(nx / d * MAX_SPEED_G - V2[2*i],   -FLEE_FORCE, FLEE_FORCE);
        ay += FLEE_W * 1.2 * clamp(ny / d * MAX_SPEED_G - V2[2*i+1], -FLEE_FORCE, FLEE_FORCE);
      }
    } else if (raptorNear) {
      gooseFleeZ();                            // 绗?8 杞?      // 缂栭槦璁╀綅: 閫冮€镐紭鍏? V 褰㈡殏鏃惰В鏁?闆佺殑"閰嶅悎"鍦ㄦ鍒昏浣嶄簬淇濆懡)
      ax += FLEE_W * 1.2 * clamp(nx / d * MAX_SPEED_G - V2[2*i],   -FLEE_FORCE, FLEE_FORCE);
      ay += FLEE_W * 1.2 * clamp(ny / d * MAX_SPEED_G - V2[2*i+1], -FLEE_FORCE, FLEE_FORCE);
    } else if (alert) {
      // 鍊熺綉棰勮: 涓嶉潬鑷繁鐨勭溂鐫? 鐩存帴璺熺潃鎯婇妞嬮笩鐨勬祦鍚戣蛋(瀹冧滑閫冨悜 = 杩滅鐚涚)
      const an = Math.hypot(alx, aly) || 1;
      const tx2 = alx / an * MAX_SPEED_G, ty2 = aly / an * MAX_SPEED_G;
      ax += FLEE_W * 1.2 * clamp(tx2 - V2[2*i],   -FLEE_FORCE, FLEE_FORCE);
      ay += FLEE_W * 1.2 * clamp(ty2 - V2[2*i+1], -FLEE_FORCE, FLEE_FORCE);
    } else {
      // 褰掍綅: 鏈濊嚜宸辩殑妲戒綅椋?妲戒綅鐢辫疆鍊煎钩绉?+ 骞奸泚鍐呴亾鍐冲畾)銆?      // 鍐呰仈妲戒綅璁＄畻(鍘?gooseSlot(i) 姣忓抚缁?60 鍙泚鍚勫垎閰嶄竴涓?{x,y} 瀵硅薄);
      // 娉ㄦ剰蹇呴』涓庢棫鐗堥€愪綅涓€鑷? wrapX/wrapY 鍏堟敹鎷㈡Ы浣嶅潗鏍? 鍐嶇畻鏈€灏忓儚宸€?      const sl = (i + gooseShift) % M;
      const rk = slotRank[sl], side = slotArm[sl] * rk * SLOT_SPACING * 0.36;
      const back = rk * SLOT_SPACING;
      const sxT = wrapX(Lx - lhx * back - lhy * side);
      const syT = wrapY(Ly - lhy * back + lhx * side);
      const gx2 = minImageX(sxT - xi), gy2 = minImageY(syT - yi);
      const gd = Math.hypot(gx2, gy2);
      if (gd > 4) {
        ax += slotScale * clamp(gx2 / gd * LEADER_SPEED - V2[2*i],   -SLOT_FORCE, SLOT_FORCE);
        ay += slotScale * clamp(gy2 / gd * LEADER_SPEED - V2[2*i+1], -SLOT_FORCE, SLOT_FORCE);
      }
      ax += 0.5 * clamp(lhx * LEADER_SPEED - V2[2*i],   -MAX_FORCE, MAX_FORCE);
      ay += 0.5 * clamp(lhy * LEADER_SPEED - V2[2*i+1], -MAX_FORCE, MAX_FORCE);
    }

    for (let j = 0; j < M; j++) {              // 闆侀棿寮卞垎绂?O(M虏), M 灏忔棤鎵€璋?
      if (j === i || !galive[j]) continue;
      const dx = minImageX(xi - P2[2*j]), dy = minImageY(yi - P2[2*j+1]);
      const d2 = dx * dx + dy * dy;
      if (d2 < GSEP_R2 && d2 > 0) {
        const dd = Math.sqrt(d2);
        ax += dx / dd * 0.05; ay += dy / dd * 0.05;
      }
    }

    if (!TORUS) {
      if (xi < -PAD) ax += BOUND_FORCE;
      else if (xi > W + PAD) ax -= BOUND_FORCE;
      if (yi < -PAD) ay += BOUND_FORCE;
      else if (yi > H + PAD) ay -= BOUND_FORCE;
    }

    let eaten = false;                         // 鐚涚椤鸿矾鎹曢: 闆佸€?100 鍒?    for (const f of threats) {
      const ex = minImageX(xi - f.x), ey = minImageY(yi - f.y);
      const ez = (GRAV_ON && EAT_3D) ? Z2[i] - f.z : 0;                     // 绗?8 杞? 3D 鍒ゅ畾
      if (ex * ex + ey * ey + ez * ez < EAT_R2_G) {
        f.score += SCORE_GOOSE; f.pending += SCORE_GOOSE; f.kills++;
        if (f.dashT > 0) f.dashEats++;         // A: 杩欐鍐插埡纭疄鍚冨埌浜嗕笢瑗?闆佷篃绠?
        if (f.kind === "eagle") f.dietGoose++;
        stats.kills++;
        gooseDies(i);                          // 姝讳骸娴佺▼(骞奸泚娌抚 / apex 鏂╅娣蜂贡)
        eaten = true;
        break;
      }
    }
    if (eaten) continue;

    let vx = V2[2*i] + ax, vy = V2[2*i+1] + ay;
    const sp = Math.hypot(vx, vy);
    if (sp > MAX_SPEED_G * leaderHustle) {
      const lim = MAX_SPEED_G * leaderHustle;
      vx = vx / sp * lim; vy = vy / sp * lim;
    }
    // 姣忓彧闆佺殑杞悜闄愰€?鍘嬪潯鎯€?: 閫熷害鏂瑰悜姣忓抚鏈€澶氳浆 GOOSE_MAX_TURN
    const curA = Math.atan2(V2[2*i+1], V2[2*i]);
    const newA = Math.atan2(vy, vx);
    const turn = clamp(angDiff(newA, curA), -GOOSE_MAX_TURN, GOOSE_MAX_TURN);
    const fA = curA + turn;
    const fSp = Math.hypot(vx, vy);
    V2[2*i] = Math.cos(fA) * fSp; V2[2*i+1] = Math.sin(fA) * fSp;
    P2[2*i]   = wrapX(xi + V2[2*i]);
    P2[2*i+1] = wrapY(yi + V2[2*i+1]);
    if (!TORUS) {                              // 銆愮 8 杞慨姝ｂ懃銆戦泚涔熻"鍘屾伓杈圭晫"
      const bd = boundAccel(xi, yi, V2[2*i], V2[2*i+1], 0);
      if (bd) {
        const pen = bd[2], F = BOUND_FORCE * pen * pen * 9;
        V2[2*i] += bd[0] * F; V2[2*i+1] += bd[1] * F;
      }
    }
    // 绗?8 杞?z 杞? 閲嶅姏 + 鏈濋闃熷眰鐨勫急寮圭哀(闆佺兢淇濇寔绋冲畾鐨勫垎灞? 涓嶆暎涔?
    if (GRAV_ON) {
      // 闆佺殑鍒嗗眰: 褰㈢姸寮圭哀(鏈濋闃熷眰) + 缁濆灞傞敋(鎶婇闃熷眰鎷夊洖 GOOSE_LAYER)銆?      // 銆愪慨 bug銆戝師寮忔槸 (Z2[leaderIdx] + 6 - Z2[i]): 瀵归闃熻€岃█鐩爣灏辨槸瀹冭嚜宸? 鍑€鍔涙亽涓烘
      // -> 鏁寸兢浠?2.5px/甯ф棤闄愮埇鍗?瀹炴祴 1500 甯?+3799px)銆傜幇鍦ㄩ闃熻缁濆灞傞敋浣? 鍏朵綑闆佽窡闅忋€?      const az2 = -G_GRAV * 0.8 + (Z2[leaderIdx] - Z2[i]) * ALT_SPRING
                + (GOOSE_LAYER - Z2[leaderIdx]) * ALT_SPRING * 0.8;
      VZ2[i] = clamp(VZ2[i] * ALT_DAMP + az2, -2.5, 2.5);   // 绗?8 杞慨姝? 鍚屾牱鍔犲瀭鍚戦樆灏?      Z2[i] = Math.max(FLOOR_Z, Z2[i] + VZ2[i]);
    }
  }

  /* ---- 6.6 楣? Q-learning 鍐崇瓥 ----
   * 鐘舵€? 瑙嗛噹鍐?闆佹洿杩? 妞嬮笩鏇磋繎?) 脳 (璺濈杩?涓?杩?, 鍏ㄧ┖ = STATE_NONE
   * 鍔ㄤ綔: 0 杩芥楦熷瘑闆嗗(浼氬啿鍒? / 1 杩芥渶杩戠殑闆?浼氬啿鍒?
   *       2 娓歌崱浼忓嚮(鍓嶇Щ鎷︽埅鐐? 涓嶅啿鍒? / 3 鏀诲嚮绔炰簤鑰?鏈€杩戠殑闅? 浼氬啿鍒?
   * 濂栧姳: 鏈抚鍚冨埌鐨勫垎(pending) - 浠ｈ阿鎴愭湰(姣忓抚), 甯ф湯鎸?(s,a)->s' 鍥炴祦鏇存柊
   * 瑙嗛噹鍐呬粈涔堥兘娌℃湁鏃? 鍏堥鍚戣蹇嗙偣, 璁板繂杩囨湡鎵嶅師鍦扮洏鏃嬫悳绱€?*/
  for (let ei = 0; ei < eagles.length; ei++) {
    const E = eagles[ei];
    if (E.stun > 0) E.stun--;                  // E: 鐪╂檿姣忓抚閫掑噺(鍦ㄥ姩浣滀箣鍓?
    const pc = E.dashT > 0 ? null : perceive(E.x, E.y, E.vx, E.vy, VIEW_EAGLE_R2);
    E.seeing = !!pc;
    if (pc) { E.memX = pc.x; E.memY = pc.y; E.memT = frame; }
    // P2D 濞佹厬閿? 閿ュ唴鎸佺画澶辫 鈥斺€?璧?pending, 璁?Q 琛ㄦ妸"鍒棷闆佺兢姝ｉ潰"瀛﹁繘鍘?    if (inCone3(E.x, E.y, E.z)) { E.pending -= CONE_EAGLE_DRAIN; stats.coneEagleDrain++; }   // 绗?8 杞? 3D 閿?
    let gi = -1, gd2 = 1e18;                   // 瑙嗛噹鍐呮渶杩戠殑闆?    for (let j = 0; j < M; j++) {
      if (!galive[j]) continue;
      const dx = minImageX(P2[2*j] - E.x), dy = minImageY(P2[2*j+1] - E.y);
      const d2 = dx * dx + dy * dy;
      if (d2 < gd2) { gd2 = d2; gi = j; }
    }
    const gDist = gi >= 0 ? Math.sqrt(gd2) : 1e9;
    const sDist = pc ? Math.hypot(minImageX(pc.x - E.x), minImageY(pc.y - E.y)) : 1e9;

    let ri = -1, rd2 = 1e18;                   // E: 鏈€杩戠殑绔炰簤鑰?闅?, 鍔ㄤ綔 3 鐨勭洰鏍?    for (let k = 0; k < falcons.length; k++) {
      const dx = minImageX(falcons[k].x - E.x), dy = minImageY(falcons[k].y - E.y);
      const d2 = dx * dx + dy * dy;
      if (d2 < rd2) { rd2 = d2; ri = k; }
    }

    let state;
    if (gDist === 1e9 && sDist === 1e9) state = STATE_NONE;
    else {
      const prey = (gDist < sDist) ? 1 : 0;
      const dd = Math.min(gDist, sDist);
      const bin = dd < 200 ? 0 : (dd < 500 ? 1 : 2);
      state = prey * 3 + bin;
    }

    let a = 2;                                 // 蔚-greedy; 鏃犵洰鏍囨椂鍙兘娓歌崱
    if (state === STATE_NONE) {
      E.hold = 0;
    } else if (E.hold > 0 && state === E.holdState) {
      a = E.holdAction; E.hold--;              // 鍐崇瓥绾厓鍐呬繚鎸佸悓涓€鍔ㄤ綔
    } else {
      if (Math.random() < E.eps) a = (Math.random() * N_ACTIONS) | 0;
      else {
        a = 0;
        for (let k = 1; k < N_ACTIONS; k++)
          if (E.Q[state*N_ACTIONS+k] > E.Q[state*N_ACTIONS+a]) a = k;
      }
      E.hold = EAGLE_DECIDE_EVERY - 1;
      E.holdState = state;
    }
    E.holdAction = a;
    if (E.curAction !== a || E.curState !== state) {     // 鍙湪鍐崇瓥鍙樺寲鏃惰 -> 涓嶅埛灞?      const ACT = ["杩芥楦?, "杩介泚", "娓歌崱浼忓嚮", "鏀诲嚮绔炰簤鑰?];
      logDec(0, falcons.length + ei, "鐘舵€?s" + state + " -> " + ACT[a] +
             "(闆佽窛 " + (gDist === 1e9 ? "-" : gDist.toFixed(0)) + ", 楦熻窛 " + (sDist === 1e9 ? "-" : sDist.toFixed(0)) +
             ", Q " + E.Q[state * N_ACTIONS + a].toFixed(2) + ")");
    }
    E.curState = state; E.curAction = a;

    let txp = 0, typ = 0, tzp = E.z, hasT = false;   // 绗?8 杞? tzp = 鐩爣楂樺害(榛樿淇濇寔)
    if (a === 1 && gi >= 0)      { txp = P2[2*gi];   typ = P2[2*gi+1]; tzp = Z2[gi]; hasT = true; }
    else if (a === 0 && pc && pc.lockIdx >= 0) {   // P1: 閲囨牱鍑虹殑"鎹炲嫼涓績"
      txp = pc.cx; typ = pc.cy; tzp = pc.z + EAGLE_LAYER_OFF; hasT = true;   // 绗?8 杞慨姝? 宸¤埅楂樹簬楦熺兢
    }
    else if (a === 2 && pc) {
      // 娓歌崱浼忓嚮: 涓嶇洿绾垮啿杩涚兢浣? 鑰屾槸椋炲埌"缇や綋琛岃繘鏂瑰悜鍓嶆柟鐨勬嫤鎴偣"绛夌潃銆?      // 涓績浠嶆潵鑷噰鏍?P1), 鐢ㄤ腑蹇冮檮杩戜唬琛ㄩ笩鐨勯€熷害澶栨帹 AMBUSH_LEAD 甯? 浼忓嚮涓嶅啿鍒恒€?      let lvx = 0, lvy = 0;
      if (pc.bi >= 0) { lvx = V[2*pc.bi]; lvy = V[2*pc.bi+1]; }
      txp = wrapX(pc.cx + lvx * AMBUSH_LEAD);
      typ = wrapY(pc.cy + lvy * AMBUSH_LEAD);
      tzp = pc.z + EAGLE_LAYER_OFF; hasT = true;   // 绗?8 杞慨姝? 娓歌崱浼忓嚮绔欓珮涓€灞?    }
    else if (a === 3 && ri >= 0) { txp = falcons[ri].x; typ = falcons[ri].y; tzp = falcons[ri].z; hasT = true; }
    else if (freshMem(E))        { txp = E.memX;     typ = E.memY;     hasT = true; }

    const dx = hasT ? minImageX(txp - E.x) : 0;
    const dy = hasT ? minImageY(typ - E.y) : 0;
    const dth = hasT ? Math.hypot(dx, dy) : 0;

    if (E.cool > 0) E.cool--;
    if (E.dashT > 0) {                         // 鍐插埡鎯€? 鏈熼棿涓嶈浆鍚?      E.dashT--;
      if (E.dashT === 0) {                     // 鍐插埡缁撴潫
        if (E.dashEats === 0) {                // A: 绌哄啿鍒? 鎵ｅ垎骞舵祦杩?Q 瀛︿範
          E.score -= MISS_PENALTY_EAGLE;
          E.pending -= MISS_PENALTY_EAGLE;
          stats.missEagle++;
        }
        E.lockIdx = -1;                        // D: 瑙ｉ櫎閿佸畾
      }
    }
    else if (E.stun <= 0 && a !== 2 && hasT && dth < EAGLE_DASH_TRIGGER && dth > 1 && E.cool === 0) {
      const curA = Math.atan2(E.vy, E.vx), tgtA = Math.atan2(dy, dx);
      if (Math.abs(angDiff(tgtA, curA)) <= DASH_MAX_ANGLE) {
        E.dashT = EAGLE_DASH_FRAMES; E.cool = EAGLE_DASH_CD;
        E.dashEats = 0;
        E.vz = clamp((tzp - E.z) * 0.04, -2.5, 2.5);   // 绗?8 杞? 鍐插埡甯﹀瀭鐩村垵閫?淇啿/鐖崌)
        // D: 鍙湁"杩芥楦?鎵嶆槸閿佸畾寮忚糠鎯?P1: 閿侀噰鏍蜂腑蹇冮偅 40px 鍐呮渶杩戠殑閭ｅ彧);
        //    杩介泚/鏀婚毤涓嶉攣(闆佸ぇ涓嶅瓨鍦ㄨ糠鎯? 瀵规墜涓嶆槸"鍚撴嚨"鐨勫璞?
        E.lockIdx = (DASH_LOCK && a === 0 && pc && pc.lockIdx >= 0) ? pc.lockIdx : -1;
        if (E.lockIdx >= 0) stats.lockedDashes++;
      }
    }
    // 绗?8 杞? 鍐插埡涓彈閲嶅姏 鈥斺€?淇啿鍔犻€?娓搁毤 stoop), 杩戝湴鎷夎捣涓嶈鎾炲湴
    if (GRAV_ON && E.dashT > 0) {
      E.vz -= G_GRAV * 0.7;
      if (E.z < GROUND_MARGIN && E.vz < 0.3) E.vz = 0.3;
    }
    // C: 琚洿鏀绘嫋鎱?+ E: 鐪╂檿鍑忛€?閮藉彧浣滅敤浜庨潪鍐插埡鐘舵€?
    const slow = Math.max(MOB_SLOW_EAGLE, 1 - E.mob * 0.005) * (E.stun > 0 ? 0.65 : 1);
    const spd = E.dashT > 0 ? EAGLE_DASH + (GRAV_ON ? Math.max(0, -E.vz) * DIVE_BOOST : 0) : EAGLE_CRUISE * slow;
    if (E.dashT === 0) {
      if (hasT && dth > 1) { E.vx += dx / dth * 0.25; E.vy += dy / dth * 0.25; }
      else {                                   // 绾悳绱? 缂撴參杞悜, 鐢诲ぇ鍦堟壘浜?        const ca = Math.cos(0.05), sa = Math.sin(0.05);
        const nvx = E.vx * ca + E.vy * sa, nvy = -E.vx * sa + E.vy * ca;
        E.vx = nvx; E.vy = nvy;
      }
    }
    applyBoundary(E, 2);                       // 寮€闃斾笘鐣屽埆椋炰涪浜?    const vs = Math.hypot(E.vx, E.vy) || 1;
    E.vx = E.vx / vs * spd; E.vy = E.vy / vs * spd;
    E.x = wrapX(E.x + E.vx); E.y = wrapY(E.y + E.vy);
    // 绗?8 杞?z 杞? 闈炲啿鍒烘椂鏈濈洰鏍囬珮搴︾埇鍗?淇啿(鐖崌鎱刊鍐插揩), 宸¤埅瀹氶珮; 杩戝湴鎷夎捣
    if (GRAV_ON) {
      if (E.dashT === 0) {
        // 銆愮 8 杞慨姝ｂ憽銆戦拱鐨勪刊鍐茬浉: 鏈夌洰鏍囦笖鏄庢樉楂樹簬瀹冩椂鍏堝帇鏈哄ご, 鍐嶅啿鍒?鍚岄毤鐨勭悊鐢?
      if (hasT && E.dashT === 0 && E.z - tzp > 40) E.stoopT = 10;
      if (E.stoopT > 0) E.stoopT--;
      const dzT = tzp - E.z;
        const des = clamp(dzT / 100, -1, 1) * (dzT > 0 ? 2.6 : 4.2);
        E.vz += clamp(des - E.vz, -DIVE_RATE, CLIMB_RATE);
      }
      if (E.z < GROUND_MARGIN && E.vz < 0.3) E.vz = 0.3;
      E.z = Math.max(3, E.z + E.vz);
    }
    trailPush(E, E.x, E.y, GRAV_ON ? E.z : Z_INIT);

    // Q 鏇存柊: 鎶婃湰甯у悆鍒扮殑鍒嗚鍒颁笂涓€姝?(鐘舵€? 鍔ㄤ綔) 澶翠笂
    E.pending -= METAB_EAGLE;                  // B: 浠ｈ阿鎴愭湰鍏堣繘 pending, 瀛︾殑鎵嶆槸鍑€鏈熸湜
    const reward = E.pending; E.pending = 0;
    if (reward < -1.5) logDec(3, falcons.length + ei, "鍑€濂栧姳 " + reward.toFixed(2) + "(鍚┖鍐插埡/閿ュ唴澶辫/浠ｈ阿)");
    let bn = E.Q[state*N_ACTIONS];
    for (let k = 1; k < N_ACTIONS; k++)
      if (E.Q[state*N_ACTIONS+k] > bn) bn = E.Q[state*N_ACTIONS+k];
    const q = E.lastState * N_ACTIONS + E.lastAction;
    E.Q[q] += Q_ALPHA * (reward + Q_GAMMA * bn - E.Q[q]);
    E.lastState = state; E.lastAction = a;
    E.eps = Math.max(EPS_MIN, E.eps * EPS_DECAY);
  }

  /* ---- 6.7 闅肩殑绛栫暐杩涘寲: (1+1)-ES 鏈熺晫缁撶畻(鍦ㄩ毤琛屽姩涔嬪墠璺? 鏂版湡鍙傛暟褰撳抚鐢熸晥) ----
   * 鍘熷垯: 鍒跺害(鑳介噺杞崲/鎷︽埅浣?浜ゆ/椹遍€?涓嶅, 瀛︾殑鏄埗搴﹀唴鐨勬搷浣滃弬鏁?鈥斺€?   * 楣板浠峰€?Q-learning), 闅煎绛栫暐(杩涘寲), 涓ょ瀛︿範鍝插鍚屾銆?   * 鍙岀紦鍐? periods 涓哄伓鏁扮殑鏈熻瘎浼?褰撳墠鍙傛暟", 濂囨暟鐨勬湡璇勪及"褰撳墠 + N(0,蟽) 鎴柇"鐨勫€欓€?
   * 鏈熸湯閰嶅姣旇緝(鏈熼暱 3600 甯? 鍥犱负閫傚簲搴﹀櫔澹板ぇ), 鍊欓€夋洿濂藉氨閲囩撼(p=cand, gen++),
   * 鍚﹀垯鍥炴粴銆傞€傚簲搴?= 鏈熷唴鍑€寰楀垎:
   *     fit = 螖score - ES_MISS_WEIGHT路危钀界┖缃氭 - ES_METAB_WEIGHT路危浠ｈ阿鎴愭湰
   * 鏃犱环鍊煎嚱鏁般€佹棤鐘舵€佹娊璞? 绾埇灞?鈥斺€?鍏佽瀛︽垚"姘镐笉鍑烘墜"鐨勫眬閮ㄦ渶浼?閫傚簲搴︹増0),
   * 閭ｆ槸璇氬疄鐨勫け璐ユā寮? 涓嶆槸 bug銆俻6 绾挎€у啿鍒虹瓥鐣ョ暀浣滄墿灞曚綅(瑙佷氦鎺ヨ鏄?銆?*/
  for (let fi = 0; fi < falcons.length; fi++) {
    const f = falcons[fi], pol = f.policy;
    if (pol.t === 0) {                           // 鏈熷垵: 閫夎繖涓€鏈熻窇璋?      if (pol.periods % 2 === 1) {
        const c = new Float64Array(ES_NP);
        for (let k = 0; k < ES_NP; k++) c[k] = clamp(pol.p[k] + randn() * ES_SIGMA, 0, 1);
        pol.evalP = c; pol.isCand = true;        // 鍊欓€?姣忓彧闅煎悇鎶藉悇鐨? 闅忔満婧愪笉鍏变韩)
      } else {
        pol.evalP = pol.p; pol.isCand = false;   // 淇濈暀褰撳墠鍙傛暟
      }
      pol.score0 = f.score; pol.miss = 0; pol.metab = 0;
    }
    pol.t++;
    if (pol.t >= (esEvalOverride || ES_EVAL_FRAMES)) {   // 鏈熸湯: 閰嶅姣旇緝 + 閲囩撼/鍥炴粴
      const fit = (f.score - pol.score0) - ES_MISS_WEIGHT * pol.miss - ES_METAB_WEIGHT * pol.metab;
      pol.lastFit = fit;
      if (pol.isCand) {
        if (fit > pol.baseFit) { pol.p.set(pol.evalP); pol.gen++; stats.esAdopt++; logDec(5, fi, "绗?" + pol.gen + " 浠ｇ瓥鐣ヨ閲囩撼(閫傚簲搴?" + fit.toFixed(1) + ")"); }
      } else {
        pol.baseFit = fit;
      }
      pol.periods++; stats.esPeriods++;
      pol.t = 0; pol.evalP = null;
    }
  }

  /* ---- 6.8 闅? 鑳介噺杞崲 + 鎷︽埅浣嶉厤鍚?+ (鍥存敾/鐪╂檿/椹遍€? + 绛栫暐鍙傛暟(P3) ---- */
  for (let fi = 0; fi < falcons.length; fi++) {
    const f = falcons[fi];
    const isActive = fi === activeId;
    if (f.stun > 0) f.stun--;                  // E: 鐪╂檿姣忓抚閫掑噺
    if (f.clashCd > 0) f.clashCd--;
    const PV_ = policyVals(f);                 // P3: 鏈瘎浼版湡鐢熸晥鐨勭瓥鐣ュ弬鏁?    const coneHit = inCone3(f.x, f.y, f.z);    // P2D/绗?8 杞? 闂繘闆佺兢姝ｉ潰 -> 澶辫(3D 閿?
    if (coneHit) stats.coneFalconFrames++;

    const pc = f.dashT > 0 ? null : perceive(f.x, f.y, f.vx, f.vy, VIEW_FALCON_R2);
    f.seeing = !!pc;
    if (pc) {
      f.memX = pc.x; f.memY = pc.y; f.memT = frame;
      // 銆愮 8 杞慨姝?/ task-3 閲嶅仛銆戝贰鑸眰楂樹簬楦熺兢, 浣嗘帴杩戞椂蹇呴』涓嬫矇鍥炵寧鐗╁眰: tryDash 瑕佹眰鍐插埡鏂瑰悜涓庡綋鍓嶉€熷害
      // 澶硅 <= 60掳, 鑻ュ缁堝仠鍦ㄧ寧鐗╂涓婃柟姘村钩宸¤埅, 淇啿瑙掓帴杩?90掳 浼氳鍒や笉鍚堟牸 -> 瀹炴祴鎬绘崟鑾?77->20銆?      // 灞傚樊鎸夋按骞宠窛绂昏“鍑?杩滃湪楂樺宸? 杩戝洖鐚庣墿灞?, 浣嗚緭鍑鸿蛋涓€闃朵綆閫?
      // 鍘熷啓娉?鐩存帴鎶?want 鍐欒繘 targetZ)浼氫笌涓嬮潰鐨勫帇鏈哄ご褰㈡垚 30 甯х骇涓婁笅鏋侀檺鐜? 璇﹁甯搁噺娉ㄩ噴銆?      const dPrey = Math.hypot(minImageX(pc.x - f.x), minImageY(pc.y - f.y));
      // task-3: 宸¤埅灞傚弬鐓?瑙嗛噹鍐呴笩缇ゅ潎楂?pc.z"(瀵瑰嚑鐧惧彧楦熸眰骞冲潎, 绋?, 涓嶅啀鐢?pc.lockZ 鈥斺€?      // lockZ 鏄?閿佸畾涓綋鐨勯珮搴?, 閿佸畾鐩爣涓€鎹㈠氨璺冲嚑鍗佸儚绱?浜戝洟鍘?卤68px), 闅艰窡鐫€瀹冧笂涓嬫憜,
      // 瀹炴祴宸¤埅楂樺害鏂瑰樊 1568 閲屽緢澶т竴鍧楁槸瀹冭础鐚殑銆備釜浣撻珮搴﹀彧鍦ㄥ啿鍒虹瀯鍑嗘椂鐢?lockAim 鐨?tz)銆?      const wantZ = pc.z + FALCON_LAYER_OFF * clamp((dPrey - FALCON_HUNT_R) / FALCON_LAYER_RAMP, 0, 1);
      f.targetZ = (f.targetZ < 0) ? wantZ : f.targetZ + (wantZ - f.targetZ) * FALCON_ALT_SLEW;
      // 銆愮 8 杞慨姝ｂ憽銆戦珮绌洪攣瀹?-> 淇啿鐩? tryDash 鐨?60掳 绾︽潫鏄**涓夌淮閫熷害**绠楃殑,
      // 鎵€浠?鍋滃湪鐚庣墿姝ｄ笂鏂?鏄啿涓嶄笅鍘荤殑銆傜湡瀹炵寷绂戒篃鏄厛鍘嬫満澶村啀淇啿: 杩欓噷璁╁畠鍦?      // 鐩爣浣嶄簬涓嬫柟涓旀按骞宠窛绂诲杩戞椂杩涘叆鐭殏淇啿鐩?鍘嬫満澶?, 閫熷害涓€鏃︽湞涓? 鍐插埡鍒ゅ畾鑷劧閫氳繃銆?      // 銆恡ask-3銆戝彧鍦?纭疄姣旂洰鏍囧眰楂樺嚭 FALCON_STOOP_DZ"鏃剁偣**涓€娆?*鐏? 鍘熷啓娉?f.stoopT = 10
      // 涓嶅甫鏉′欢, 浜庢槸鍙杩樺湪楂樺灏辨瘡甯х画鏈? 鍘嬫満澶存案涓嶇粨鏉? 涓?targetZ 鐨勪笂鎽嗗懡浠や簰鐩告墦鏋躲€?      if (f.stoopT === 0 && f.z - f.targetZ > FALCON_STOOP_DZ && dPrey < 460 && f.energy >= PV_.dashMin) {
        logDec(1, fi, "楂樼┖閿佸畾 -> 淇啿鐩?楂樹簬鐩爣灞?" + (f.z - f.targetZ).toFixed(0) + "px, 姘村钩 " + dPrey.toFixed(0) + "px)");
        f.stoopT = 10;
      }
      // task-3: 淇啿鐩告湡闂存妸鐩爣灞備竴骞跺帇鍒扮寧鐗╁眰 鈥斺€?"鎵胯寮忎笅娼?, 10 甯х粨鏉熷悗涓嶄細鍐嶅洖寮瑰埌宸¤埅灞?      if (f.stoopT > 0) f.targetZ = pc.z;
    }
    if (f.stoopT > 0) f.stoopT--;

    if (f.dashT > 0) {
      // 鍐插埡: 閫熷害閿佸畾涓嶈皟鏁? B 浠ｈ阿 + C 鍥存敾鑰呰秺澶氱儳寰楄秺蹇?瀹瑰繊搴?p5 鐢?ES 瀛?
      f.dashT--;
      const coneMult = coneHit ? CONE_FALCON_DASH_MULT : 1;      // P2D: 閿ュ唴鍐插埡鑳借€?脳2
      const drain = (DASH_DRAIN * (1 + f.mob * MOB_DRAIN_PER * PV_.mobTol) + METAB_DASH) * coneMult;
      f.energy = Math.max(0, f.energy - drain);
      f.policy.metab += drain;                 // P3: 浠ｈ阿鎴愭湰璁″叆閫傚簲搴?      applyBoundary(f, 2);
      // 绗?8 杞? 鍐插埡涓彈閲嶅姏 鈥斺€?淇啿鍔犻€?stoop), 杩戝湴鎷夎捣
      if (GRAV_ON) {
        f.vz -= G_GRAV * 0.7;
        if (f.z < GROUND_MARGIN && f.vz < 0.3) f.vz = 0.3;
      }
      // C: 琚洿鍒颁复鐣屽€?-> 鍐插埡琚‖鐢熺敓鎵撴柇, 璧颁笅闈㈡甯哥殑钀界┖缃氭娴佺▼
      if (f.mob >= MOB_PENALTY_N) { f.dashT = 0; stats.mobInterrupts++; }
      const effDash = DASH_SPEED + (GRAV_ON ? Math.max(0, -f.vz) * DIVE_BOOST : 0);
      const ps = Math.hypot(f.vx, f.vy);
      if (ps > 1e-9) { f.vx = f.vx / ps * effDash; f.vy = f.vy / ps * effDash; }
      if (f.dashT === 0) {                     // 鍐插埡缁撴潫
        if (f.dashEats === 0) {                // A: 绌哄啿鍒烘墸鍒?          f.score -= MISS_PENALTY_FALCON;
          f.policy.miss += MISS_PENALTY_FALCON;   // P3: 钀界┖缃氭璁″叆閫傚簲搴?          stats.missFalcon++;
        }
        // P1 楠屾敹鍙栨牱: 鍐插埡缁堢偣 80px 鍐呰繕鏈夊灏戝彲瑙侀笩(鎷ｈ蒋澶勪笅鍙ｆ槸鍚﹁嚜鍙戜骇鐢?
        const pe = perceive(f.x, f.y, f.vx, f.vy, 80 * 80);
        stats.dashEnds++;
        stats.dashEndBirds += pe ? pe.n : 0;
        if (f.dashS > stats.dashMaxEats) stats.dashMaxEats = f.dashS;
        if (f.lockIdx >= 0) {                  // 閿佸畾鍐插埡(鎹曠寧)
          if (f.dashS > stats.dashMaxEatsLocked) stats.dashMaxEatsLocked = f.dashS;
        } else if (f.dashS > stats.dashMaxEatsFree) stats.dashMaxEatsFree = f.dashS;
        // P2D 楠屾敹: 缁堢偣涓?V 灏栫殑鍏崇郴(閿ユ槸鍚︾湡鐨勬妸鍐插埡鎸ゅ紑浜?
        if (galiveCount > 0) {
          const dA = Math.hypot(minImageX(f.x - Lx), minImageY(f.y - Ly));
          stats.dashEndApexSum += dA;
          if (dA < 200) stats.dashEndApexNear++;
          if (inCone3(f.x, f.y, f.z)) stats.dashEndInCone++;      // 绗?8 杞? 3D 閿?        }
        f.circleT = falconRest(f);             // task-3: 鎭㈠鏈?= 鍩虹嚎 卤 绉佹湁鎶栧姩 + 鐤插姵椤?涓嶅啀鏄畾鍊?110)
        f.lockIdx = -1;                        // D: 瑙ｉ櫎閿佸畾
      }
    } else {
      // C 鍥存敾 + E 鐪╂檿: 閮藉彧鎷栨參闈炲啿鍒虹姸鎬?      const slow = Math.max(MOB_SLOW_FALCON, 1 - f.mob * 0.01) * (f.stun > 0 ? 0.6 : 1);

      // 鐩樻棆: 缂撴參缁曞湀(鎵€鏈夐潪鍐插埡鐘舵€侀兘鍙犺繖涓€灞傝浆鍚?
      const ca = Math.cos(CIRCLE_TURN), sa = Math.sin(CIRCLE_TURN);
      const nvx = f.vx * ca + f.vy * sa;
      const nvy = -f.vx * sa + f.vy * ca;
      f.vx = nvx; f.vy = nvy;

      if (isActive) {
        // 杩界寧鏂? 瑙嗛噹鍐呮湞缇や綋璐ㄥ績淇, 鐪嬩笉瑙佸氨椋炲悜璁板繂鐐?        if (pc) {
          const dfx = minImageX(pc.x - f.x), dfy = minImageY(pc.y - f.y);
          const df = Math.hypot(dfx, dfy);
          if (df > 200) { f.vx += dfx / df * 0.6; f.vy += dfy / df * 0.6; }
        } else if (freshMem(f)) {
          const mx = minImageX(f.memX - f.x), my = minImageY(f.memY - f.y);
          const md = Math.hypot(mx, my);
          if (md > 1) { f.vx += mx / md * 0.6; f.vy += my / md * 0.6; }
        }
        applyBoundary(f, 2);
        const ps = Math.hypot(f.vx, f.vy);
        const cspd = CIRCLE_SPEED * slow;
        if (ps > 1e-9) { f.vx = f.vx / ps * cspd; f.vy = f.vy / ps * cspd; }

        f.energy = Math.min(ENERGY_MAX, f.energy + ACTIVE_REGEN - METAB_CIRCLE);
        f.policy.metab += METAB_CIRCLE;
        f.circleT--;

        // 鑳介噺浣?p2) -> 閫€鍑鸿拷鐚? 璁╄浼忎綅鐨勫彟涓€鍙珛鍒绘帴妫?        if (f.energy < PV_.energyLow) {
          activeId = (fi + 1) % falcons.length;
          falcons[activeId].circleT = 0;
          continue;
        }
        // 鐩樻棆鏈熸弧 + 鑳介噺澶?p1) + 涓嶆檿 + 閲囨牱鍒板彲鐢ㄧ洰鏍?-> 鍐插埡(60掳 绾︽潫, D 閿佸畾)
        if (f.circleT <= 0 && f.energy >= PV_.dashMin && f.stun <= 0 && pc) {
          if (pc.cx < 0) { stats.noLockAborts++; f.circleT = 4; }   // P1: 40px 鍐呮棤楦?-> 鏀惧純(闅斿嚑甯у啀閲囨牱)
          else if (dashAtPrey(f, pc)) {   // task-3: 鍐插埡鐬勯攣瀹氫釜浣撶殑鍓嶇疆鐐? 钀界┖閫€鍥炴崬鍕轰腑蹇?        logDec(1, fi, "杩界寧鍐插埡: 閲囨牱涓績 (" + pc.cx.toFixed(0) + "," + pc.cy.toFixed(0) + ") z=" + pc.z.toFixed(0) +
               " 閿佸畾#" + pc.lockIdx + " 鑳介噺 " + f.energy.toFixed(0));
      } else { f.circleT = 8; logDec(2, fi, "杩界寧鍐插埡钀界┖(鑸悜澶硅杩囧ぇ)"); }
        }
      } else {
        // 璁句紡鏂? 涓嶇畻鍏ㄥ眬楦熺兢, 鍙敤鑷繁瑙嗛噹閲岀殑璐ㄥ績鎺ㄦ嫤鎴綅 鈥斺€?        // 楦熺兢鎬绘湞杩滅杩界寧鏂圭殑鏂瑰悜閫? 閫冮€歌蛋寤婄殑灏藉ご灏辨槸璁句紡鐐?p4 澶栨帹姣斾緥鍙)銆?        let travel = false, tx = 0, ty = 0, d = 0;
        if (pc) {
          const af = falcons[activeId];
          const ax0 = minImageX(pc.x - af.x), ay0 = minImageY(pc.y - af.y);
          const ipx = wrapX(pc.x + ax0 * PV_.interceptAhead);
          const ipy = wrapY(pc.y + ay0 * PV_.interceptAhead);
          tx = minImageX(ipx - f.x); ty = minImageY(ipy - f.y);
          d = Math.hypot(tx, ty);
          travel = d > INTERCEPT_MIN;
        } else if (freshMem(f)) {
          tx = minImageX(f.memX - f.x); ty = minImageY(f.memY - f.y);
          d = Math.hypot(tx, ty);
          travel = d > INTERCEPT_MIN;
        }
        if (travel && d > 1) {
          // 鏈埌鎷︽埅浣? 楂橀€熻刀璺?A 鐗? 璁句紡鏂归€熷害 7.5 > 鐩樻棆 5.0)
          f.vx += clamp(tx / d * REST_SPEED - f.vx, -0.8, 0.8);
          f.vy += clamp(ty / d * REST_SPEED - f.vy, -0.8, 0.8);
        } else if (pc && d > 1) {
          f.vx += tx / d * INTERCEPT_GAIN;     // 宸插埌浣? 灏忓箙璐村悜璁句紡鐐?          f.vy += ty / d * INTERCEPT_GAIN;
        }
        applyBoundary(f, 2);
        const ps = Math.hypot(f.vx, f.vy);
        const spd = (travel ? REST_SPEED : CIRCLE_SPEED) * slow;
        if (ps > 1e-9) { f.vx = f.vx / ps * spd; f.vy = f.vy / ps * spd; }

        f.energy = Math.min(ENERGY_MAX, f.energy + REST_REGEN - METAB_CIRCLE);
        f.policy.metab += METAB_CIRCLE;
        f.circleT--;

        // 鍋跺彂鍙屾墦(p3): 璁句紡鏂硅兘閲忓緢婊′笖閲囨牱鍒板彲鐢ㄧ洰鏍囨椂, 涓嶇瓑鎺ユ鐩存帴鍑烘墜
        if (f.circleT <= 0 && f.energy >= PV_.doubleTeam && f.stun <= 0 && pc) {
          if (pc.cx < 0) { stats.noLockAborts++; f.circleT = 4; }
          else if (dashAtPrey(f, pc)) {   // task-3: 鍐插埡鐬勯攣瀹氫釜浣撶殑鍓嶇疆鐐? 钀界┖閫€鍥炴崬鍕轰腑蹇?        logDec(1, fi, "鍙岄毤澶瑰嚮鍐插埡: 鑳介噺 " + f.energy.toFixed(0) + " 閿佸畾#" + pc.lockIdx);
      } else { f.circleT = 10; logDec(2, fi, "澶瑰嚮鍐插埡钀界┖(鑸悜澶硅杩囧ぇ)"); }
        }
      }

      // E 椹遍€愬啿鍒? 浼樺厛绾т綆浜庢崟鐚?鈥斺€?闄勮繎鏈夊鎵?鍙︿竴鍙毤鎴栭拱)涓旇兘閲忓灏辨挒涓婂幓,
      // 鎾炰笂鍚庣敱 6.9 鐨勪簰鏀诲垽瀹氬喅鑳滆礋銆傛病鏈夌寧鐗╁彲杩芥椂杩欏氨鏄敮涓€鍑鸿矾銆?      if (f.dashT === 0 && f.stun <= 0 && f.circleT <= 0 && f.energy >= PV_.dashMin) {
        let rv = null, rvd2 = 1e18;
        for (const r of raptors) {
          if (r === f) continue;
          const dx = minImageX(r.x - f.x), dy = minImageY(r.y - f.y);
          const d2 = dx * dx + dy * dy;
          if (d2 < rvd2) { rvd2 = d2; rv = r; }
        }
        if (rv && rvd2 < RIVAL_R * RIVAL_R) {
          if (tryDash(f, rv.x, rv.y, -1, rv.z)) {
          logDec(1, fi, "椹遍€愮珵浜夎€呭啿鍒?鐩爣 z=" + rv.z.toFixed(0) + ")");
        } else { f.circleT = 6; logDec(2, fi, "椹遍€愬啿鍒鸿惤绌?); }
        }
      }
    }
    f.x = wrapX(f.x + f.vx);
    f.y = wrapY(f.y + f.vy);
    // 绗?8 杞?z 杞? 闈炲啿鍒烘椂鏈濈洰鏍囬珮搴︾埇鍗?淇啿, 宸¤埅瀹氶珮; 杩戝湴鎷夎捣
    if (GRAV_ON) {
      if (f.dashT === 0) {
        // task-3: 鍨傚悜鍙湁涓€涓洰鏍囧眰(淇啿鐩稿湪涓婇潰鐨?if(pc) 閲屽凡鎶婄洰鏍囧眰鍘嬪埌鐚庣墿灞?, 涓旀帶鍒跺櫒
        // 鍔犱簡 FALCON_ALT_LEAD 甯х殑鍓嶇灮闃诲凹: 鍘熸潵鐨?pure-P + vz 閫熺巼闄愬箙(鐖?0.14 / 淇?0.26)
        // 鏄瑺闃诲凹鐨?鈥斺€?鍐茶繃鐩爣灞傚悗瑕?30 甯ф墠鑳芥妸 vz 鍙嶅彿, 浜庢槸鑷繁灏辨憜璧锋潵浜嗐€?        const tzF = (f.targetZ >= 0) ? f.targetZ : f.z;
        const dzT = tzF - f.z;
        const des = clamp((dzT - FALCON_ALT_LEAD * f.vz) / 100, -1, 1) * (dzT > 0 ? 2.6 : 4.2);
        f.vz += clamp(des - f.vz, -DIVE_RATE, CLIMB_RATE);
      }
      if (f.z < GROUND_MARGIN && f.vz < 0.3) f.vz = 0.3;
      f.z = Math.max(3, f.z + f.vz);
    }
    trailPush(f, f.x, f.y, GRAV_ON ? f.z : Z_INIT);
  }

  /* ---- 6.9 鐚庣墿琛ュ厖 ---- */
  if (frame % REFILL_CHECK === 0) maybeRefill();

  /* ---- 6.10 鐚涚浜掓敾(椹遍€愬埗): 涓夊彧涓や袱鍒ゅ畾 ----
   * 瀹炲姏 = 鍐插埡涓?+2 / 楣颁綋鍨?+1.5 / 鐪╂檿 -3 / 鍣０;
   * 璐ユ柟琚嚮閫€ + 鐪╂檿 + 鎵ｅ垎 + 琚姠璧板墿浣欏垎鏁扮殑 STEAL_FRAC; 鑳滄柟鎷胯蛋鎶㈡潵鐨勫垎銆?   * 鍔犱簡 CLASH_CD 鍐峰嵈: 鍚﹀垯璐村湪涓€璧风殑涓ゅ彧鐚涚浼氶€愬抚浜掔浉鎵ｅ垎, 鍒嗘暟鐬棿宕╂帀銆?*/
  for (let i = 0; i < raptors.length; i++) {
    for (let j = i + 1; j < raptors.length; j++) {
      const A = raptors[i], B = raptors[j];
      if (A.clashCd > 0 || B.clashCd > 0) continue;
      const dx = minImageX(B.x - A.x), dy = minImageY(B.y - A.y);
      const d2 = dx * dx + dy * dy;
      if (d2 >= CLASH_R * CLASH_R || d2 < 1e-6) continue;

      const sA = (A.dashT > 0 ? 2 : 0) + (A.kind === "eagle" ? 1.5 : 0) + (A.stun > 0 ? -3 : 0) + Math.random();
      const sB = (B.dashT > 0 ? 2 : 0) + (B.kind === "eagle" ? 1.5 : 0) + (B.stun > 0 ? -3 : 0) + Math.random();
      const win = sA >= sB ? A : B, lose = win === A ? B : A;
      const md = Math.sqrt(d2);
      const nx = dx / md, ny = dy / md;              // A -> B 鐨勫崟浣嶅悜閲?
      // 璐ユ柟琚嚮閫€(浣嶇疆 + 閫熷害閮芥帹涓€鎶?, 鐪╂檿, 鎵ｅ垎, 琚姠鍒?      lose.x = wrapX(lose.x + (lose === B ? nx : -nx) * CLASH_KNOCK);
      lose.y = wrapY(lose.y + (lose === B ? ny : -ny) * CLASH_KNOCK);
      lose.vx = (lose === B ? nx : -nx) * 4;
      lose.vy = (lose === B ? ny : -ny) * 4;
      lose.stun = CLASH_STUN;
      if (lose.dashT > 0) {                          // 琚墦鏂殑鍐插埡鍚屾牱璧拌惤绌虹綒娆炬祦绋?        if (lose.dashEats === 0) {
          if (lose.kind === "eagle") {
            lose.score -= MISS_PENALTY_EAGLE; lose.pending -= MISS_PENALTY_EAGLE; stats.missEagle++; logDec(3, 255, "楣扮┖鍐插埡缃氭 -" + MISS_PENALTY_EAGLE);
          } else {
            lose.score -= MISS_PENALTY_FALCON; stats.missFalcon++; logDec(3, lose === eagle ? falcons.length : falcons.indexOf(lose), "绌哄啿鍒虹綒娆?-" + MISS_PENALTY_FALCON);
          }
        }
        if (lose.kind !== "eagle") lose.circleT = CIRCLE_FRAMES;
      }
      lose.dashT = 0; lose.lockIdx = -1;
      lose.score -= CLASH_COST;
      const stolen = lose.score > 0 ? Math.floor(lose.score * STEAL_FRAC) : 0;
      lose.score -= stolen;
      win.score += stolen;
      win.dashEats++;                                // 鑳滄柟鍏嶇┖鍐插埡缃氭
      // 楣扮殑濂栨儵瑕佽蛋 pending, 鍚﹀垯 Q 瀛︿範鐪嬩笉瑙佷簰鏀昏繖浠朵簨
      if (win.kind === "eagle") win.pending += stolen;
      logDec(4, 255, win.label.split(" ")[0] + " 椹遍€愭垚鍔?鎶㈠垎 " + stolen + ")");
      if (lose.kind === "eagle") lose.pending -= CLASH_COST;
      A.clashCd = CLASH_CD; B.clashCd = CLASH_CD;
      stats.clashes++;
      if (stolen > 0) stats.steals++;
    }
  }
}

/* ============================================================================
 * 绗?8 杞? 3D 瑙嗚灞?鈥斺€?杞ㄩ亾鐩告満 + 閫忚鎶曞奖 + 闆? * ----------------------------------------------------------------------------
 * 涓栫晫鍧愭爣: x 鍙? y 涓?z 杞村悜涓?銆傞粯璁?3D 鐜粫瑙嗚(鎷栨嫿鏃嬭浆 / 婊氳疆缂╂斁 /
 * 鐩爣鑷姩璺熼殢缇や綋璐ㄥ績涓庡潎楂?; ?view=top 杩涘叆鏃т刊瑙?鎶曞奖灞傞€€鍖栦负鎭掔瓑鏄犲皠,
 * 鎵€鏈夋棫娓叉煋璺緞鍘熸牱宸ヤ綔)銆侴L3D 鍚庣涓嶅彲鐢ㄦ椂鐨勫厹搴曟槸 CPU 杞姇褰?鎱? 浣嗘纭?銆? * ========================================================================== */
let VIEW3D = true;
try { if (/[?&]view=top/.test(window.location.search)) VIEW3D = false; } catch (e) { /* headless */ }
let gl3dReady = false;
let ovClear = false;                       // 鍙犲姞灞傛湰甯ф槸鍚﹂渶瑕?clear(搴曞眰鏄?GL 涓嶉€忔槑鐢婚潰鏃?
const cam = { yaw: 0.7, pitch: 0.52, dist: 950, tx: W / 2, ty: H / 2, tz: Z_INIT, auto: false };   // 銆愮 8 杞慨姝ｂ懁銆戦粯璁や笉鑷姩杞?瑕佽浆鍐嶅嬀)
let vpM = new Float32Array(16);

function perspM(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2), m = new Float32Array(16);
  m[0] = f / aspect; m[5] = f; m[10] = (far + near) / (near - far); m[11] = -1;
  m[14] = 2 * far * near / (near - far);
  return m;
}
function lookAtM(ex, ey, ez, cx, cy, cz) {
  let fx = cx - ex, fy = cy - ey, fz = cz - ez;
  const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
  // 涓栫晫涓婃柟鍚?= +z
  const sx = fy, sy = -fx, sz = 0;           // s = f 脳 up(涓栫晫涓婃柟鍚戝彇 +z): (fy, -fx, 0) 鈥斺€?sz 鎭掍负 0
  const sl = Math.hypot(sx, sy) || 1;
  const ux2 = sy * fz - sz * fy, uy2 = sz * fx - sx * fz, uz2 = sx * fy - sy * fx;  // s 脳 f
  const m = new Float32Array(16);
  m[0] = sx;  m[1] = ux2; m[2] = -fx; m[3] = 0;
  m[4] = sy;  m[5] = uy2; m[6] = -fy; m[7] = 0;
  m[8] = sz;  m[9] = uz2; m[10] = -fz; m[11] = 0;
  m[12] = -(sx * ex + sy * ey + sz * ez);
  m[13] = -(ux2 * ex + uy2 * ey + uz2 * ez);
  m[14] = (fx * ex + fy * ey + fz * ez);
  m[15] = 1;
  return m;
}
function mulM(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let t = 0;
    for (let k = 0; k < 4; k++) t += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = t;
  }
  return o;
}
function updateCamera() {
  cam.tx += (cxmI - cam.tx) * 0.04;
  cam.ty += (cymI - cam.ty) * 0.04;
  cam.tz += (zMeanLive - cam.tz) * 0.04;
  if (cam.auto) cam.yaw += 0.0022;         // 鏃犺緭鍏ユ椂缂撴參鍏浆
  cam.pitch = clamp(cam.pitch, -1.25, 1.42);
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const ex = cam.tx + Math.sin(cam.yaw) * cp * cam.dist;
  const ey = cam.ty - Math.cos(cam.yaw) * cp * cam.dist;
  const ez = Math.max(24, cam.tz + sp * cam.dist + 40);
  vpM = mulM(perspM(0.92, W / H, 2, 6000), lookAtM(ex, ey, ez, cam.tx, cam.ty, cam.tz));
}

/* 3D -> 灞忓箷銆備刊瑙嗘ā寮忛€€鍖栦负鎭掔瓑鏄犲皠(涓庢棫 2D 瀹屽叏涓€鑷?;
 * s = 杩戝ぇ杩滃皬绯绘暟, f = 闆?杩滄贰), ok = 鍦ㄨ閿ュ唴銆?*/
const PR_A = { x: 0, y: 0, s: 1, f: 1, ok: true };
const PR_B = { x: 0, y: 0, s: 1, f: 1, ok: true };
const PR_C = { x: 0, y: 0, s: 1, f: 1, ok: true };
function project(x, y, z, out) {
  if (!VIEW3D) { out.x = x; out.y = y; out.s = 1; out.f = 1; out.ok = true; return out; }
  const m = vpM;
  const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
  const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
  const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (cw < 2) { out.ok = false; return out; }
  out.ok = true;
  out.x = (cx / cw * 0.5 + 0.5) * W;
  out.y = (0.5 - cy / cw * 0.5) * H;
  out.s = clamp(420 / cw, 0.22, 3.4);
  out.f = clamp(1.3 - cw * 0.00115, 0.18, 1);
  return out;
}

function toggleView() {
  VIEW3D = !VIEW3D;
  const b = document.getElementById("btnView");
  if (b) b.textContent = VIEW3D ? "鍒囨崲淇锛圱锛? : "鍒囨崲 3D锛圱锛?;
  if (VIEW3D && !gl3dReady && !glTried) tryInitGL();
}

/* 鐩告満杈撳叆: 宸﹂敭鎷栨嫿鏃嬭浆(鑷姩鍏宠嚜鍔ㄧ幆缁?, 婊氳疆缂╂斁; 闈㈡澘鏄嫭绔?DOM, 涓嶅啿绐?*/
(function camInput() {
  const stage = document.getElementById("stage");
  let dragging = false, lx = 0, ly = 0;
  stage.addEventListener("mousedown", e => { dragging = true; lx = e.clientX; ly = e.clientY; cam.auto = false;
    const cb = document.getElementById("cbAuto"); if (cb) cb.checked = false; });
  window.addEventListener("mousemove", e => {
    if (!dragging) return;
    cam.yaw += (e.clientX - lx) * 0.006;
    cam.pitch = clamp(cam.pitch + (e.clientY - ly) * 0.005, -1.25, 1.42);
    lx = e.clientX; ly = e.clientY;
  });
  window.addEventListener("mouseup", () => dragging = false);
  stage.addEventListener("wheel", e => {
    e.preventDefault();
    cam.dist = clamp(cam.dist * Math.exp(e.deltaY * 0.001), 260, 3400);
  }, { passive: false });
})();

/* ------------------------------ 7. 娓叉煋 ------------------------------ */

const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");
const qcv = document.getElementById("qcv");
const qctx = qcv.getContext("2d");

// 娓叉煋鍚庣閫夋嫨: 榛樿 WebGL(搴曞眰瀹炰緥鍖?, ?render=2d 寮哄埗璧板師鏉ョ殑 Canvas2D 鍏ㄨ矾寰?let glReady = false, glTried = false, forceGL = false, glUsed = false;
let want2D = false;
try { want2D = /[?&]render=2d/.test(window.location.search); } catch (e) { /* 鏃?location(headless) */ }

// 鎬ц兘 EMA(闈㈡澘涓?SIM.perf 閮界敤瀹?: stepMs / renderMs / gl + WebGPU 璁＄畻涓夋鑰楁椂
const perf = { stepMs: 0, renderMs: 0, gl: false, uploadMs: 0, gpuMs: 0, readbackMs: 0 };
function perfPush(step, render) {
  perf.stepMs = perf.stepMs * 0.9 + step * 0.1;
  perf.renderMs = perf.renderMs * 0.9 + render * 0.1;
}

// 璁＄畻鍚庣閫夋嫨: ?compute=cpu | gpu | auto(榛樿). CPU 璺緞姘镐箙淇濈暀浣滃弬鐓т笌鍏滃簳銆?let computeMode = "auto", gpuCompute = false;
try {
  const m = /[?&]compute=(\w+)/.exec(window.location.search);
  if (m && ["cpu", "gpu", "auto"].indexOf(m[1]) >= 0) computeMode = m[1];
} catch (e) { /* 鏃?location(headless) */ }
let computeSelfCheck = null, computeInitInfo = null;
let diagMode = false;                          // ?diag=1: 鍛ㄦ湡鎬у線鎺у埗鍙版墦涓€琛屾€ц兘/鐘舵€? 渚夸簬鏃犲ご鎴栫湡鏈哄彇璇?try { diagMode = /[?&]diag=1/.test(window.location.search); } catch (e) { /* 鏃?location */ }
let diagTicks = 0;
let initTimeoutMs = 3000;                      // WebGPU 鍒濆鍖栬秴鏃??initTimeout=ms 鍙皟, 鎱㈡満鍣?鍐峰惎鍔ㄧ敤)
try {
  const m = /[?&]initTimeout=(\d+)/.exec(window.location.search);
  if (m) initTimeoutMs = Math.max(500, Math.min(60000, +m[1]));
} catch (e) { /* 鏃?location */ }

// 浜ょ粰 WebGPU 璁＄畻鍚庣(绗笁涓?<script>)鐨勫満鏅ˉ: 瀹氬瀷鏁扮粍 + 缃戞牸甯搁噺 + CPU 鍙傝€冨疄鐜扮殑鍥炶皟
const computeScene = {
  W, H, P, V, ACC, alive, maxN: MAXN,
  counts: () => ({ n: N }),
  grid: {
    get gw() { return GW; }, get gh() { return GH; },
    get topoK() { return topoK; }, cell: CELL, pad: PAD, torus: TORUS,
    perceptionR2: PERCEPTION_R2, sepR2: SEP_R2, sepGain: SEP_GAIN,
    maxSpeed: MAX_SPEED, maxForce: MAX_FORCE, cohesionW: COHESION_W, alignmentW: ALIGNMENT_W,
  },
  // 鑷鐢? 璺戜竴閬?CPU 鐗?6.1+6.2 骞舵妸 ACC 鎷疯繘 out(涓嶅姩鍏跺畠鐘舵€?
  cpuForces: (out) => {
    const saveCxm = cxmI, saveCym = cymI;
    cpuGridAndForces(TORUS);
    out.set(ACC.subarray(0, out.length));
    cxmI = saveCxm; cymI = saveCym;
  },
  perf,
};

// 浜ょ粰 WebGL 鍚庣鐨勫満鏅ˉ(绗簩涓?<script> 鍖哄潡閲岀殑 GLBackend 鐩存帴璇昏繖浜涘畾鍨嬫暟缁?
  const glScene = {
    // 銆愮 8 杞慨姝ｂ懃銆憇.W/s.H 鏄?*瑙嗗彛**(绾圭悊/鎶曞奖/鍍忕礌灏哄害閮界敤瀹?, 涓栫晫灏哄鍙︾粰 worldW/worldH
    W: VIEW_W, H: VIEW_H, worldW: W, worldH: H, P, V, alive, P2, V2, galive, maxN: MAXN, maxM: M,
  Z, VZ, Z2, VZ2,                                    // 绗?8 杞? 3D 瀹炰緥灞炴€ф簮
  counts: () => ({ n: N, m: M, aliveCount, galiveCount }),
  colors: { starling: [200 / 255, 215 / 255, 235 / 255], goose: [255 / 255, 200 / 255, 110 / 255] },
  shapes: { starling: BODY_S, goose: BODY_G },   // [灏栫, 灏鹃暱, 缈煎睍] 涓?2D 鐨?drawArrow 鍏辩敤鍚屼竴缁勫父閲?  bg: [10 / 255, 12 / 255, 18 / 255],
  // 涓夌淮娓叉煋鍙傛暟(绗?8 杞皟浼?: 浣撶Н鍊嶆暟 + 楂樺害鑼冨洿(浜害鏄犲皠) + 瑙嗗満瑙?绠楀儚绱犲昂搴?
  fov: 0.92,
  get size3dMul() { return SIZE3D_MUL; },
  get trail3() { return { on: TRAIL3_ON, len: TRAIL3_LEN, w: TRAIL3_W, alpha: TRAIL3_ALPHA }; },
  // 绗?8 杞慨姝? 璇婃柇"鍔犲噺鐚涚鍚庡埆鍚嶆槸鍚︽寚鍚戞椿瀵硅薄"
  raptorRefs: () => ({ eagleIsLive: eagle === (eagles[0] || null), eagleNull: eagle === null,
                       falcons: falcons.map(f => f.label), eagles: eagles.map(E => E.label),
                       total: raptors.length, activeId }),
  get stoop() { return raptors.map(r => r.stoopT || 0); },
  size3dMinPx: SIZE3D_MINPX,
  get zLow() { return zLowLive; },
  get zHigh() { return zHighLive; },
  fade: 0.16,                                    // 涓?fillRect(rgba(10,12,18,0.16)) 绛変环
  perf,
};

// ---- UI 鐘舵€?----
let showVision = false, showFormation = true, refillOn = true;
let paused = false, speedMul = 1;
let fpsEma = 60, lastT = performance.now(), lastPanelT = 0;

// 娓叉煋渚ч浂鍒嗛厤: 铏氱嚎鏍峰紡鏁扮粍涓庤緣鍏夌簿鐏甸兘棰勭敓鎴愪竴娆? 涓嶅啀姣忓抚 new
const EMPTY_DASH = [];
const DASH_VISION = [4, 10], DASH_MEM = [5, 7], DASH_AXIS = [3, 9], DASH_FORM = [6, 8], DASH_MINI = [3, 4];
const glowSprites = new Map();                // 棰滆壊 -> 64脳64 棰勬覆鏌撳緞鍚戣緣鍏?function glowSprite(C) {
  let s = glowSprites.get(C);
  if (s) return s;
  const c = document.createElement("canvas");
  c.width = 64; c.height = 64;
  const g2 = c.getContext("2d");
  const grad = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(${C}, 1)`);
  grad.addColorStop(1, `rgba(${C}, 0)`);
  g2.fillStyle = grad;
  g2.fillRect(0, 0, 64, 64);
  glowSprites.set(C, c);
  return c;
}

function drawArrow(x, y, vx, vy, sTip, sBack, sWing) {
  // 閫氱敤 ">": 灏栫鍦ㄩ€熷害鏂瑰悜 sTip 澶? 鎵归噺濉炶繘鍚屼竴鏉?path 涓€娆℃弿杈?  const sp = Math.hypot(vx, vy) || 1;
  const ux = vx / sp, uy = vy / sp, qx = -uy, qy = ux;
  const tx = x + ux * sTip, ty = y + uy * sTip;
  const bx = x - ux * sBack, by = y - uy * sBack;
  ctx.moveTo(bx + qx * sWing, by + qy * sWing);
  ctx.lineTo(tx, ty);
  ctx.lineTo(bx - qx * sWing, by - qy * sWing);
}

// 鎷栧熬鐜舰缂撳啿: 瀹氬 Float32Array + 澶存寚閽? 鎺ㄤ竴涓偣 O(1), 姘镐笉鍒嗛厤(绗?8 杞? 3 鍒嗛噺)
function trailPush(o, x, y, z) {
  const L = TRAIL_LEN;
  if (o.trailN < L) {
    const idx = (o.trailHead + o.trailN) * 3;
    o.trailBuf[idx] = x; o.trailBuf[idx + 1] = y; o.trailBuf[idx + 2] = z; o.trailN++;
  } else {
    o.trailBuf[o.trailHead * 3] = x; o.trailBuf[o.trailHead * 3 + 1] = y; o.trailBuf[o.trailHead * 3 + 2] = z;
    o.trailHead = (o.trailHead + 1) % L;
  }
}

/* ---- 绗?8 杞? 灏镐綋涓嬪潬(琚悆鐨勯笩甯﹀垵閫熷仛鎶涗綋, 钀藉湴鍋滀綇鍚庢秷鏁? ---- */
const CORPSE_CAP = 384;
const cX = new Float32Array(CORPSE_CAP), cY = new Float32Array(CORPSE_CAP), cZ = new Float32Array(CORPSE_CAP);
const cVX = new Float32Array(CORPSE_CAP), cVY = new Float32Array(CORPSE_CAP), cVZ = new Float32Array(CORPSE_CAP);
const cT = new Float32Array(CORPSE_CAP);          // 瀛樻椿甯ф暟(0 = 绌轰綅)
let cCursor = 0;
function spawnCorpse(x, y, z, vx, vy, vz) {
  const k = cCursor;
  cX[k] = x; cY[k] = y; cZ[k] = z; cVX[k] = vx; cVY[k] = vy; cVZ[k] = vz; cT[k] = 1;
  cCursor = (cCursor + 1) % CORPSE_CAP;
}
function stepCorpses() {
  if (!GRAV_ON) return;
  for (let k = 0; k < CORPSE_CAP; k++) {
    if (cT[k] <= 0) continue;
    cT[k]++;
    cVZ[k] -= 0.055;                             // 灏镐綋鍙彈閲嶅姏(鏃犲脊绨?
    cX[k] += cVX[k]; cY[k] += cVY[k]; cZ[k] += cVZ[k];
    if (cZ[k] <= FLOOR_Z) {                      // 钀藉湴: 婊戝姩琛板噺, 鍋滅暀 60 甯у悗娑堟暎
      cZ[k] = FLOOR_Z; cVX[k] *= 0.8; cVY[k] *= 0.8; cVZ[k] = 0;
      if (cT[k] > 60) cT[k] = 0;
    } else if (cT[k] > 240) cT[k] = 0;
  }
}

// 鎷栧熬棰滆壊瀛楃涓茬紦瀛? 鎸?棰滆壊, 閫忔槑搴︽。浣?棰勭敓鎴? 閬垮厤姣忔涓€娆℃ā鏉垮瓧绗︿覆
const TRAIL_BUCKETS = 12;
const trailColorCache = new Map();
function trailColor(C, a) {
  let bucket = (a * TRAIL_BUCKETS) | 0;
  if (bucket < 0) bucket = 0; else if (bucket >= TRAIL_BUCKETS) bucket = TRAIL_BUCKETS - 1;
  const key = C + "|" + bucket;
  let s = trailColorCache.get(key);
  if (s === undefined) {
    s = `rgba(${C}, ${((bucket + 0.5) / TRAIL_BUCKETS).toFixed(3)})`;
    trailColorCache.set(key, s);
  }
  return s;
}

// 鐚涚鐨勫叕鍏辩敾娉?闅?楣板叡鐢? 绗?8 杞? 鍏ㄥ潗鏍囪繃 project(), 杩戝ぇ杩滃皬 + 闆?銆?// 杩斿洖 {x,y,s,f} 缁欐爣绛?鑳介噺鏉″鐢? 鍦ㄨ閿ュ杩斿洖 null銆?function drawHunter(h, dash, opt) {
  const C = h.color;
  project(h.x, h.y, h.z, PR_A);
  if (!PR_A.ok) return null;
  const sx = PR_A.x, sy = PR_A.y, ss = PR_A.s, ff = PR_A.f;

  const n = h.trailN;
  if (n >= 2) {                                // 鐜舰缂撳啿鎸夋椂闂村簭杩炵偣(3D 鎶曞奖)
    const L = TRAIL_LEN;
    ctx.lineCap = "round";
    let px = 0, py = 0, open = true;
    for (let k = 0; k < n; k++) {
      const idx = ((h.trailHead + k) % L) * 3;
      project(h.trailBuf[idx], h.trailBuf[idx + 1], h.trailBuf[idx + 2], PR_B);
      if (!PR_B.ok) { open = true; continue; }
      if (!open) {
        const dx = PR_B.x - px, dy = PR_B.y - py;
        if (dx * dx + dy * dy <= 2500 * ss * ss) {   // 鎶曞奖璺冲彉(杞埌鑳屼晶)涓嶈繛绾?          ctx.strokeStyle = trailColor(C, opt.trailA * (k + 1) / n * ff);
          ctx.lineWidth = (dash ? 2.5 : 1.5) * Math.max(0.55, ss);
          if (dash) { ctx.shadowColor = `rgb(${C})`; ctx.shadowBlur = 14; }
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(PR_B.x, PR_B.y);
          ctx.stroke();
        }
      }
      px = PR_B.x; py = PR_B.y; open = false;
    }
    ctx.shadowBlur = 0;
  }

  if (h.shock) {                               // 鍐插埡鍐插嚮娉?甯﹂珮搴?
    h.shock.t++;
    const alpha = (1 - h.shock.t / 35) * ff;
    if (h.shock.t >= 35 || alpha <= 0.02) h.shock = null;
    else {
      project(h.shock.x, h.shock.y, h.shock.z || Z_INIT, PR_B);
      const r = h.shock.t * 9 * ss;
      if (PR_B.ok && r > 0.6) {
        ctx.strokeStyle = `rgba(${C}, ${alpha * 0.8})`;
        ctx.lineWidth = 2.5 * ss;
        ctx.shadowColor = `rgb(${C})`; ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(PR_B.x, PR_B.y, r, 0, TAU);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
  }

  if (showVision && opt.visionR) {             // 瑙嗛噹鐞?-> 灞忓箷鍦?鍗婂緞闅忔繁搴︾缉鏀?
    const r = opt.visionR * ss;
    if (r > 4) {
      ctx.save();
      ctx.setLineDash(DASH_VISION);
      ctx.strokeStyle = `rgba(${C}, ${0.10 * ff})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  if (!h.seeing && freshMem(h)) {              // 鎼滅储涓? 鏈濊蹇嗙偣鐨勮櫄绾?    project(h.memX, h.memY, h.z, PR_B);
    if (PR_B.ok) {
      ctx.save();
      ctx.setLineDash(DASH_MEM);
      ctx.strokeStyle = `rgba(${C}, ${0.20 * ff})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(PR_B.x, PR_B.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  const glowR = (dash ? opt.glowDash : opt.glow) * ss;
  ctx.globalAlpha = (dash ? 0.55 : opt.glowA) * ff;
  ctx.drawImage(glowSprite(C), sx - glowR, sy - glowR, glowR * 2, glowR * 2);
  ctx.globalAlpha = 1;

  // 鏈濆悜: 鎶曞奖"浣嶇疆 + 閫熷害脳6"涓ょ偣, 鐢ㄥ睆骞曡繛绾挎柟鍚戠敾 ">"(椋炶濮挎€佸湪灞忓箷涓婅嚜鐒跺憟鐜?
  project(h.x + h.vx * 6, h.y + h.vy * 6, h.z + h.vz * 6, PR_B);
  const avx = PR_B.ok ? PR_B.x - sx : h.vx, avy = PR_B.ok ? PR_B.y - sy : h.vy;
  ctx.strokeStyle = `rgb(${C})`;
  ctx.lineWidth = (dash ? 2.2 : 1.5) * Math.max(0.55, ss);
  ctx.shadowColor = `rgb(${C})`;
  ctx.shadowBlur = dash ? 24 : 12;
  ctx.beginPath();
  drawArrow(sx, sy, avx, avy, (dash ? opt.size[0] : opt.size[1]) * ss, opt.size[2] * ss, opt.size[2] * ss);
  ctx.stroke();
  ctx.shadowBlur = 0;
  PR_C.x = sx; PR_C.y = sy; PR_C.s = ss; PR_C.f = ff;
  return PR_C;
}

/* render2D(): 鍘?Canvas2D 鍏ㄨ矾寰?鎷栧熬娈嬪奖 + 楦熺兢鏈綋), 鐢??render=2d 鎴?GL 涓嶅彲鐢ㄦ椂璧?   renderOverlay(): 涓ょ妯″紡鍏辩敤鐨?2D 鍙犲姞灞?濞佹厬閿?缂栭槦绾?娑熸吉/鐚涚/灏忓湴鍥?鏍囩) */
function render2D() {
  // GL 鏇剧粡璺戣繃鍙堜腑閫旈檷绾ф椂, 搴曞眰 canvas 杩樼暀鐫€涓婁竴甯? 鍏堥摵涓€灞備笉閫忔槑鑳屾櫙
  if (glUsed) { ctx.fillStyle = "#0a0c12"; ctx.fillRect(0, 0, W, H); glUsed = false; }
  // 鍗婇€忔槑瑕嗙洊 = 鎵€鏈夐笩鑷甫鎷栧熬(浠ｄ环浣? 鏁堟灉濂?
  ctx.fillStyle = "rgba(10, 12, 18, 0.16)";
  ctx.fillRect(0, 0, W, H);

  if (!TORUS) {                                // 瑙嗗彛鍙槸涓栫晫鐨勪竴鎵囩獥
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }

  // ---- 妞嬮笩(鐏扮櫧, 涓€鎵?path 涓€娆℃弿杈? F: 浣撳瀷鏀跺皬) ----
  ctx.strokeStyle = "rgb(200, 215, 235)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    if (!alive[i]) continue;
    drawArrow(P[2*i], P[2*i+1], V[2*i], V[2*i+1], BODY_S[0], BODY_S[1], BODY_S[2]);
  }
  ctx.stroke();

  // 闆佺殑鏈綋(2D 璺緞); GL 妯″紡涓嬭繖涓ゆ鐢?shader 瀹炰緥鍖栫粯鍒?  ctx.strokeStyle = "rgb(255, 200, 110)";
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  for (let i = 0; i < M; i++) {
    if (!galive[i]) continue;
    drawArrow(P2[2*i], P2[2*i+1], V2[2*i], V2[2*i+1], BODY_G[0], BODY_G[1], BODY_G[2]);
  }
  ctx.stroke();

  renderOverlay();
}

// 2D 鍙犲姞灞?绗?8 杞? 鍏ㄩ儴缁?project() 鈥斺€?淇妯″紡閫€鍖栦负鏃?2D 琛屼负):
// 鐚涚/鏍囩/鑳介噺鏉?娑熸吉/灏镐綋/灏忓湴鍥?瑙嗛噹鍦?閰嶅悎杞寸嚎/濞佹厬閿ャ€傚疄浣撴暟 <= 20, Canvas2D 澶熺敤銆?function renderOverlay() {
  if (ovClear) ctx.clearRect(0, 0, W, H);      // 搴曞眰 GL 宸茬敾涓嶉€忔槑鐢婚潰 -> 鍏堟竻鍙犲姞灞?  else if (!TORUS) {
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }

  // ---- 闆佺兢: 濞佹厬閿?3D 鎵囧舰鎶曞奖) / 缂栭槦绾?/ 鏁伴噺鏍囩 ----
  if (galiveCount > 0) {
    const LZ = Z2[leaderIdx];
    const fan = (r, fill, stroke) => {
      project(Lx, Ly, LZ, PR_A);
      if (!PR_A.ok) return;
      ctx.beginPath();
      ctx.moveTo(PR_A.x, PR_A.y);
      let closed = false;
      for (let k = 0; k <= 14; k++) {
        const a = leaderAng - CONE_HALF_ANGLE + (k / 14) * CONE_HALF_ANGLE * 2;
        project(Lx + Math.cos(a) * r, Ly + Math.sin(a) * r, LZ, PR_B);
        if (!PR_B.ok) { closed = false; continue; }
        ctx.lineTo(PR_B.x, PR_B.y);
        closed = true;
      }
      if (!closed) return;
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
    };
    fan(CONE_R, "rgba(120, 190, 255, 0.045)");
    fan(CONE_R * 0.55, "rgba(120, 190, 255, 0.05)");
    fan(CONE_R, null, "rgba(120, 190, 255, 0.18)");
  }
  if (showFormation) {                         // V 褰袱鏉＄考鐨勫紩瀵肩嚎(鎶曞奖绔偣)
    const hx = Math.cos(leaderAng), hy = Math.sin(leaderAng);
    const qx = -hy, qy = hx;
    const rank = (M >> 1);
    const back = rank * SLOT_SPACING, side = rank * SLOT_SPACING * 0.36;
    ctx.save();
    ctx.setLineDash(DASH_FORM);
    ctx.strokeStyle = "rgba(255, 200, 110, 0.13)";
    ctx.lineWidth = 1;
    for (const arm of [1, -1]) {
      project(Lx, Ly, Z2[leaderIdx], PR_A);
      project(Lx - hx * back + qx * side * arm, Ly - hy * back + qy * side * arm, Z2[leaderIdx], PR_B);
      if (PR_A.ok && PR_B.ok) {
        ctx.beginPath();
        ctx.moveTo(PR_A.x, PR_A.y);
        ctx.lineTo(PR_B.x, PR_B.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  project(Lx, Ly, Z2[leaderIdx], PR_A);
  if (PR_A.ok) {
    ctx.fillStyle = "rgb(255, 200, 110)";
    ctx.font = "bold 12px 'Microsoft YaHei', sans-serif";
    ctx.fillText("闆?GEESE 脳" + galiveCount, PR_A.x + 12, PR_A.y - 10);
  }

  // ---- 姝讳骸娑熸吉(鎶曞奖鍒扮兢浣撻珮搴﹀眰) + 灏镐綋涓嬪潬(3D 鐐? 钀藉湴娓愰殣) ----
  for (let k = 0; k < DEATH_CAP; k++) {
    if (deathT[k] <= 0) continue;
    const t = ++deathT[k], alpha = 1 - t / 22;
    if (alpha <= 0) { deathT[k] = 0; continue; }
    project(deathX[k], deathY[k], Z_INIT, PR_A);
    if (!PR_A.ok) continue;
    ctx.strokeStyle = `rgba(255, 110, 100, ${alpha * 0.9 * PR_A.f})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(PR_A.x, PR_A.y, (2 + t * 0.4) * PR_A.s, 0, TAU);
    ctx.stroke();
  }
  if (GRAV_ON) {
    ctx.fillStyle = "rgb(180, 195, 215)";
    for (let k = 0; k < CORPSE_CAP; k++) {
      if (cT[k] <= 0) continue;
      project(cX[k], cY[k], cZ[k], PR_A);
      if (!PR_A.ok) continue;
      const grounded = cZ[k] <= FLOOR_Z;
      const fade = grounded ? Math.max(0, 1 - (cT[k] - 1) / 60) : 1;
      ctx.globalAlpha = 0.55 * PR_A.f * fade;
      const r = Math.max(1, 1.6 * PR_A.s);
      ctx.fillRect(PR_A.x - r / 2, PR_A.y - r / 2, r, r);
    }
    ctx.globalAlpha = 1;
  }

  // ---- 闅肩兢閰嶅悎杞寸嚎(鎶曞奖, 鏋佹贰铏氱嚎) ----
  if (falcons.length >= 2) {
    const f1 = falcons[0], f2 = falcons[1];
    project(f1.x, f1.y, f1.z, PR_A);
    project(f1.x + minImageX(f2.x - f1.x), f1.y + minImageY(f2.y - f1.y), f2.z, PR_B);
    if (PR_A.ok && PR_B.ok) {
      ctx.save();
      ctx.setLineDash(DASH_AXIS);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PR_A.x, PR_A.y);
      ctx.lineTo(PR_B.x, PR_B.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ---- 闅?----
  for (let fi = 0; fi < falcons.length; fi++) {
    const f = falcons[fi];
    const dash = f.dashT > 0;
    const isActive = fi === activeId;
    const hp = drawHunter(f, dash, { visionR: VIEW_FALCON, trailA: 0.7, glowDash: 20, glow: 14,
                          glowA: isActive ? 0.35 : 0.18, size: BODY_F });
    if (!hp) continue;
    const bw = 28 * hp.s, bh = 3 * Math.max(0.6, hp.s), bx = hp.x - bw / 2, by = hp.y - 20 * hp.s;
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = `rgb(${f.color})`;
    ctx.fillRect(bx, by, bw * f.energy / ENERGY_MAX, bh);
    ctx.fillStyle = `rgba(200, 200, 200, ${0.6 * hp.f})`;
    ctx.font = "10px 'Microsoft YaHei', sans-serif";
    ctx.fillText(isActive ? "杩界寧" : "璁句紡", bx + bw + 3, by + bh);
    ctx.fillStyle = `rgba(150, 200, 160, ${0.75 * hp.f})`;
    ctx.fillText("绛栫暐 " + f.policy.gen + "浠?, bx, by - 4);
    if (f.stun > 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.9 * hp.f})`;
      ctx.fillText("鐪╂檿 " + f.stun, bx - 1, by - 15);
    }
    ctx.fillStyle = `rgb(${f.color})`;
    ctx.font = "bold 12px 'Microsoft YaHei', sans-serif";
    ctx.fillText(f.label, hp.x + 11 * hp.s, hp.y - 8 * hp.s);
  }

  // ---- 楣?鏀寔澶氬彧; 0 鍙椂鑷劧璺宠繃) ----
  for (let ei = 0; ei < eagles.length; ei++) {
    const E = eagles[ei];
    const dash = E.dashT > 0;
    const hp = drawHunter(E, dash, { visionR: VIEW_EAGLE, trailA: 0.55, glowDash: 19, glow: 16,
                          glowA: 0.4, size: BODY_E });
    if (!hp) continue;
    ctx.fillStyle = "rgb(255, 190, 60)";
    ctx.font = "bold 12px 'Microsoft YaHei', sans-serif";
    ctx.fillText(E.label + "  蔚=" + E.eps.toFixed(2), hp.x + 12 * hp.s, hp.y - 10 * hp.s);
    if (E.stun > 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.9 * hp.f})`;
      ctx.font = "10px 'Microsoft YaHei', sans-serif";
      ctx.fillText("鐪╂檿 " + E.stun, hp.x - 16 * hp.s, hp.y - 22 * hp.s);
    }
  }

  drawMinimap();
}

/* 3D 杞欢鍏滃簳娓叉煋(GL3D 涓嶅彲鐢ㄤ笖澶勪簬 3D 瑙嗚鏃?: CPU 鎶曞奖 + 闆? 鎱絾姝ｇ‘銆? * 妞嬮笩/闆佸悇涓€鎵?path; 澶у皬/閫忔槑搴﹂殢娣卞害銆備粎浣滃厹搴? 姝ｅ父璺緞璧?GL3D 瀹炰緥鍖栥€?*/
function renderSoft3D() {
  ctx.fillStyle = "#0a0c12";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgb(200, 215, 235)";
  ctx.lineWidth = 0.8;
  for (let i = 0; i < N; i++) {
    if (!alive[i]) continue;
    project(P[2*i], P[2*i+1], Z[i], PR_A);
    if (!PR_A.ok) continue;
    project(P[2*i] + V[2*i] * 4, P[2*i+1] + V[2*i+1] * 4, Z[i] + VZ[i] * 4, PR_B);
    ctx.globalAlpha = PR_A.f;
    ctx.beginPath();
    if (PR_B.ok) drawArrow(PR_A.x, PR_A.y, PR_B.x - PR_A.x, PR_B.y - PR_A.y,
                           BODY_S[0] * PR_A.s, BODY_S[1] * PR_A.s, BODY_S[2] * PR_A.s);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgb(255, 200, 110)";
  for (let i = 0; i < M; i++) {
    if (!galive[i]) continue;
    project(P2[2*i], P2[2*i+1], Z2[i], PR_A);
    if (!PR_A.ok) continue;
    project(P2[2*i] + V2[2*i] * 4, P2[2*i+1] + V2[2*i+1] * 4, Z2[i] + VZ2[i] * 4, PR_B);
    ctx.globalAlpha = PR_A.f;
    ctx.beginPath();
    if (PR_B.ok) drawArrow(PR_A.x, PR_A.y, PR_B.x - PR_A.x, PR_B.y - PR_A.y,
                           BODY_G[0] * PR_A.s, BODY_G[1] * PR_A.s, BODY_G[2] * PR_A.s);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/* ---- 娓叉煋鍒嗗彂(绗?8 杞? 3D 瑙嗚浼樺厛, 淇/2D 鍏ㄨ矾寰勪繚鐣欎綔 A/B 涓庡厹搴? ---- */
function render() {
  const t0 = performance.now();
  updateCamera();                              // 鐩告満璺熼殢缇や綋璐ㄥ績+鍧囬珮(姣忓抚, 鏆傚仠鏃朵篃鐢熸晥)
  if (VIEW3D) {
    if (gl3dReady) {
      try {
        window.GLBackend.draw3D(glScene, vpM); // 搴曞眰: 閫忚 + 娣卞害 + 闆? 涓ゆ壒瀹炰緥鍖?        glUsed = true;
      } catch (e) {
        gl3dReady = false;
        console.warn("WebGL3D 寮傚父, 鍥為€€杞覆鏌?", e && e.message);
      }
    }
    if (!gl3dReady) renderSoft3D();            // CPU 鎶曞奖鍏滃簳(鎱? 浣嗚涓烘纭?
    ovClear = gl3dReady;                       // GL 搴曚笉閫忔槑 -> 鍙犲姞灞傝娓? 杞覆鏌撶敾鍦?ctx 涓?-> 涓嶆竻
    renderOverlay();
  } else {
    if (glReady) {
      try {
        window.GLBackend.draw(glScene);        // 鏃?2D 瀹炰緥鍖?淇涓撶敤)
        glUsed = true;
      } catch (e) {
        glReady = false;
        perf.gl = false;
        console.warn("WebGL 鍚庣寮傚父, 鍥為€€ Canvas2D:", e && e.message);
      }
    }
    ovClear = glReady;
    if (glReady) renderOverlay();
    else render2D();                           // 鍘?Canvas2D 鍏ㄨ矾寰?  }
  perf.renderMs = perf.renderMs * 0.9 + (performance.now() - t0) * 0.1;
  perf.gl = glReady;
}

// 灏忓湴鍥? 寮€闃斾笘鐣屼笓鐢?鈥斺€?瑙嗗彛鍙槸涓€閮ㄥ垎, 蹇呴』鏈変釜鍏ㄥ眬瑙嗗浘鐪嬮笩缇よ窇鍝幓浜?function drawMinimap() {
  if (TORUS) return;
  const mw = 210, mh = mw * (H + 2 * PAD) / (W + 2 * PAD);
  const ox = 14, oy = H - 14 - mh;
  const sx = mw / (W + 2 * PAD), sy = mh / (H + 2 * PAD);
  const mx = x => ox + (x + PAD) * sx, my = y => oy + (y + PAD) * sy;

  ctx.save();
  ctx.fillStyle = "rgba(10, 12, 18, 0.6)";
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.rect(ox, oy, mw, mh); ctx.fill(); ctx.stroke();

  ctx.setLineDash(DASH_MINI);                     // 瑙嗗彛鑼冨洿
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath(); ctx.rect(mx(0), my(0), W * sx, H * sy); ctx.stroke();
  ctx.setLineDash(EMPTY_DASH);

  ctx.fillStyle = "rgba(200,215,235,0.5)";     // 妞嬮笩鎶芥牱, 1px 鐐?  for (let i = 0; i < N; i += 6) {
    if (!alive[i]) continue;
    ctx.fillRect(mx(P[2*i]) - 0.5, my(P[2*i+1]) - 0.5, 1, 1);
  }
  ctx.fillStyle = "rgb(255,200,110)";          // 闆?  for (let i = 0; i < M; i++) {
    if (!galive[i]) continue;
    ctx.fillRect(mx(P2[2*i]) - 1, my(P2[2*i+1]) - 1, 2, 2);
  }
  for (const f of threats) {                   // 鐚涚
    ctx.fillStyle = `rgb(${f.color})`;
    ctx.fillRect(mx(f.x) - 1.5, my(f.y) - 1.5, 3, 3);
  }
  // P2: 棰嗛槦浣嶇疆 + 濞佹厬閿ユ柟鍚?灏忓湴鍥句笂鏈€瀹规槗鐪嬪嚭"闆佺兢鍦ㄨ翰璋?)
  if (galiveCount > 0) {
    ctx.fillStyle = "rgba(120,190,255,0.9)";
    ctx.fillRect(mx(Lx) - 2, my(Ly) - 2, 4, 4);
    ctx.strokeStyle = "rgba(120,190,255,0.5)";
    ctx.beginPath();
    ctx.moveTo(mx(Lx), my(Ly));
    ctx.lineTo(mx(Lx + Math.cos(leaderAng) * 60), my(Ly + Math.sin(leaderAng) * 60));
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(150,155,168,0.75)";
  ctx.font = "10px 'Microsoft YaHei', sans-serif";
  ctx.fillText(`寮€闃斾笘鐣?${W + 2 * PAD}脳${H + 2 * PAD}锛堣櫄绾?= 瑙嗗彛锛塦, ox + 2, oy - 4);
  ctx.restore();
}

// 楣拌剳 Q 琛ㄧ儹鍔涘浘(灏?canvas, 6Hz 鍒锋柊瓒冲)
function renderQ() {
  const w = qcv.width, h = qcv.height;
  qctx.clearRect(0, 0, w, h);
  if (!eagles.length) {                        // 绗?8 杞? 楣板噺鍒?0 鏃?Q 琛ㄧ暀绌?    qctx.fillStyle = "rgba(150,155,170,0.5)";
    qctx.font = "10px 'Microsoft YaHei', sans-serif";
    qctx.fillText("鏃犻拱(澧炴彺宸叉竻绌?", 6, h / 2);
    return;
  }
  qctx.fillStyle = "rgba(255,255,255,0.03)";
  qctx.fillRect(0, 0, w, h);

  const labelW = 30, headH = 15;
  const cw = (w - labelW) / N_ACTIONS, ch = (h - headH) / N_STATES;
  const rows = ["妞嬭繎", "妞嬩腑", "妞嬭繙", "闆佽繎", "闆佷腑", "闆佽繙", "鍏ㄧ┖"];
  const cols = ["杩芥", "杩介泚", "浼忓嚮", "鏀婚毤"];

  let maxQ = 1e-6;
  for (let s = 0; s < N_STATES; s++)
    for (let a = 0; a < N_ACTIONS; a++)
      maxQ = Math.max(maxQ, eagle.Q[s * N_ACTIONS + a]);

  qctx.font = "9px 'Microsoft YaHei', sans-serif";
  qctx.textBaseline = "middle";
  for (let a = 0; a < N_ACTIONS; a++) {
    qctx.fillStyle = "rgba(180,185,200,0.8)";
    qctx.fillText(cols[a], labelW + a * cw + cw / 2 - 11, headH / 2);
  }
  for (let s = 0; s < N_STATES; s++) {
    const y = headH + s * ch;
    const cur = (s === eagle.curState);
    // 璇ョ姸鎬佷笅鐨勮椽蹇冨姩浣?椤堕儴浜嚎), 涓€鐪肩湅鍑?瀛︿細浜嗕粈涔?銆?    // 鑻ョ涓€鍚嶄笌绗簩鍚嶅樊璺?<5%, 浜嚎鐢绘垚鍗婇€忔槑 鈥斺€?琛ㄧず"杩樻病瀛﹀嚭鍋忓ソ",
    // 鍏嶅緱鐢ㄦ埛浠ヤ负鐑姏鍥惧湪闂氨鏄潖浜?闆佽繎琛屽父骞村氨鏄繖绉嶅娍鍧囧姏鏁?銆?    let ga = 0, gb = -1;
    for (let a = 1; a < N_ACTIONS; a++) {
      const v = eagle.Q[s * N_ACTIONS + a], cur2 = eagle.Q[s * N_ACTIONS + ga];
      if (v > cur2) { gb = ga; ga = a; } else if (a !== ga && (gb < 0 || v > eagle.Q[s * N_ACTIONS + gb])) gb = a;
    }
    const best = eagle.Q[s * N_ACTIONS + ga];
    const second = gb >= 0 ? eagle.Q[s * N_ACTIONS + gb] : -Infinity;
    const tie = !(best > second) || (best - second) < 0.05 * Math.max(maxQ, 1e-6);
    const hasValue = maxQ > 1e-6 && best > 1e-6;
    qctx.fillStyle = cur ? "rgba(255,220,140,0.95)" : "rgba(150,155,170,0.65)";
    qctx.fillText(rows[s], 2, y + ch / 2);
    for (let a = 0; a < N_ACTIONS; a++) {
      const x = labelW + a * cw;
      const v = Math.max(0, eagle.Q[s * N_ACTIONS + a]) / maxQ;   // 0..1 浜害
      qctx.fillStyle = `hsl(${210 - 165 * v}, ${35 + 40 * v}%, ${10 + 38 * v}%)`;
      qctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
      if (s !== STATE_NONE && hasValue) {                    // 璐績鍔ㄤ綔: 椤堕儴涓€鏉′寒绾?        if (a === ga) {
          qctx.fillStyle = tie ? "rgba(255,235,170,0.35)" : "rgba(255,235,170,0.9)";
          qctx.fillRect(x + 3, y + 2, cw - 6, 1.5);
        }
      }
      if (cur && a === eagle.curAction) {                    // 褰撳墠鍐崇瓥楂樹寒
        qctx.strokeStyle = "rgba(255,255,255,0.95)";
        qctx.lineWidth = 1.5;
        qctx.strokeRect(x + 1.5, y + 1.5, cw - 3, ch - 3);
      }
    }
  }
}

/* --------------------- 8. 璁″垎鏉?/ 鎺т欢 / 涓诲惊鐜?--------------------- */

const el = id => document.getElementById(id);

/* ---- 鐘舵€佹爮鍙敹璧? 鎸夐挳鎴栧揩鎹烽敭 H 鍒囨崲, 灏介噺璁颁綇涓婃鐘舵€?---- */
const PANEL_KEY = "boids.panelCollapsed";
let panelHidden = false;
function setPanelHidden(hide, persist) {
  panelHidden = !!hide;
  const p = el("panel");
  if (p && p.classList) p.classList.toggle("collapsed", panelHidden);
  const b = el("btnHide");
  if (b) b.textContent = panelHidden ? "灞曞紑 鈼? : "鏀惰捣 鈻?;
  if (persist) {
    try { localStorage.setItem(PANEL_KEY, panelHidden ? "1" : "0"); } catch (e) { /* file:// 涓嬪彲鑳戒笉鍙敤 */ }
  }
}
el("btnHide").onclick = () => setPanelHidden(!panelHidden, true);
try { if (localStorage.getItem(PANEL_KEY) === "1") setPanelHidden(true, false); } catch (e) { /* 蹇界暐 */ }

/* ---- 绗?8 杞箣涓? 鍔ㄦ€佽鍒嗘澘 ----
 * 鍘熼潰鏉垮啓姝?3 琛?闅尖憼鈶?楣?, 鍔犲叆楣伴毤鍚庡鍑烘潵鐨勪釜浣撴牴鏈笉鏄剧ず -> 鐜板湪鎸?raptors 鍔ㄦ€佸缓琛屻€? * 鍏煎: 鍓嶄袱鍙毤涓庣涓€鍙拱浠嶅垎鍒寕 s0/k0銆乻1/k1銆乻2/k2 涓変釜鑰?id(鏃㈡湁娴嬭瘯/鑴氭湰渚濊禆瀹冧滑)銆?*/
let scoreRoster = -1, scoreRowEls = [];
const ACT_NAME = ["杩芥楦?, "杩介泚", "娓歌崱浼忓嚮", "鏀诲嚮绔炰簤鑰?];
function buildScoreRows() {
  const body = el("scoreBody");
  if (!body) return;
  const list = [];
  falcons.forEach((f, i) => list.push({ r: f, name: "闅? + (CN_NUM[i] || "#" + (i + 1)),
    idS: i === 0 ? "s0" : (i === 1 ? "s1" : null), idK: i === 0 ? "k0" : (i === 1 ? "k1" : null) }));
  eagles.forEach((E, i) => list.push({ r: E, name: "楣? + (CN_NUM[i] || "#" + (i + 1)),
    idS: i === 0 ? "s2" : null, idK: i === 0 ? "k2" : null }));
  // 娓呯┖: snapshot + removeChild 鈥斺€?娴忚鍣ㄩ噷 body.children 鏄?HTMLCollection(娌℃湁 shift/splice),
  // 鏃犲ご娴嬭瘯妗╁垯鏄櫘閫氭暟缁? 杩欑宸紓鍙湁鐪熸満璺戞墠浼氭毚闇?绗?8 杞箣涓夊疄娴嬭俯鍒?銆?  const kids = [];
  for (let i = 0; i < body.children.length; i++) kids.push(body.children[i]);
  for (const c of kids) body.removeChild(c);
  scoreRowEls = list.map(item => {
    const tr = document.createElement("tr");
    const c0 = document.createElement("td");
    c0.style.color = "rgb(" + item.r.color + ")";
    c0.textContent = item.name;
    const c1 = document.createElement("td"); c1.className = "num"; c1.textContent = "0";
    const c2 = document.createElement("td"); c2.className = "num"; c2.textContent = "0";
    const c3 = document.createElement("td"); c3.className = "st"; c3.textContent = "-";
    if (item.idS) c1.id = item.idS;                     // 鑰佸绾? 鍓嶄笁琛屼粛鍙?s0/s1/s2, k0/k1/k2
    if (item.idK) c2.id = item.idK;
    [c0, c1, c2, c3].forEach(c => tr.appendChild(c));
    body.appendChild(tr);
    return { r: item.r, s: c1, k: c2, st: c3 };
  });
  scoreRoster = falcons.length * 100 + eagles.length;
}
function raptorStateText(r) {
  // 灏介噺绱у噾 + 鏁板瓧瀹氬(鐢?nbsp 琛ラ綈): 鍒楀鍥哄畾, 鏂囨湰闀垮害涔熷浐瀹? 鐘舵€佸垪灏变笉浼氫竴璺充竴璺?  const NB = "\u00A0";
  const pad = (s, n) => String(s).padStart(n, NB);
  const b = [];
  if (r.stun > 0) b.push("鐪╂檿");
  else if (r.dashT > 0) b.push("鍐插埡");
  else if (r.circleT > 0) b.push("鐩樻棆");
  else b.push("娓哥寧");
  if (r.kind === "eagle") b.push(["杩介笩", "杩介泚", "浼忓嚮", "浜掓敾"][r.curAction | 0] || "-");
  if (r.energy !== undefined) b.push("鑳? + pad(Math.round(r.energy), 3) + "%");
  if (r.mob > 0) b.push("鍥? + pad((r.mob / 60).toFixed(0), 2) + "s");   // mob 鏄疮鍔犲抚鏁? 鎹㈢畻鎴?琚洿鏀诲灏戠"
  if (r.lockIdx >= 0) b.push("#" + pad(r.lockIdx, 3));
  return b.join("路");
}
function refreshScore() {
  const roster = falcons.length * 100 + eagles.length;
  if (roster !== scoreRoster) buildScoreRows();
  let ts = 0, tk = 0, dash = 0;
  for (const row of scoreRowEls) {
    const r = row.r;
    row.s.textContent = r.score;
    row.k.textContent = r.kills;
    const txt = raptorStateText(r);
    if (row.st.textContent !== txt) row.st.textContent = txt;
    row.st.style.color = r.dashT > 0 ? "#ffb37a" : (r.stun > 0 ? "#ff8fa0" : "#7d8bb0");
    ts += r.score; tk += r.kills;
    if (r.dashT > 0) dash++;
  }
  el("scoreTotal").textContent = ts;
  el("killTotal").textContent = tk;
  const secs = stats.steps / 60;
  el("rateTotal").textContent = (tk / Math.max(secs, 1) * 60).toFixed(1) + "/鍒? + (dash ? " 路 鍐插埡涓?" + dash : "");
  el("scoreSummary").textContent = "缂栧埗 闅?脳" + falcons.length + " 路 楣?脳" + eagles.length;
}
function refreshPanel() {
  const E0 = eagles[0] || null;                // 绗?8 杞? 楣板彲鍑忓埌 0, 椋熻氨/蔚 绛夐兘瑕佸畧鍗?  refreshScore();
  el("aliveS").textContent = aliveCount;
  el("aliveG").textContent = galiveCount;
  el("aliveSPct").textContent = (aliveCount / Math.max(1, N) * 100).toFixed(0) + "%";
  el("aliveGPct").textContent = (galiveCount / Math.max(1, M) * 100).toFixed(0) + "%";
  const zr = SIMzRange();
  el("zStar").textContent = zr.starling ? zr.starling.mean.toFixed(0) : "鈥?;
  el("zGoose").textContent = zr.goose ? zr.goose.mean.toFixed(0) : "鈥?;
  el("zSpan").textContent = zr.starling ? (zr.starling.hi - zr.starling.lo).toFixed(0) : "鈥?;
  el("corpseN").textContent = corpseCount();
  refreshRaidLine();                           // 绗?7 杞? 澧炴彺缂栧埗涓庢垬鏋?  {                                            // 绗?8 杞? 鐚涚鍐崇瓥鏃ュ織(鏈€鍚?3 鏉?
    const tail = decTail(3);
    el("decLine").innerHTML = tail.length
      ? tail.map(d => "f" + d.frame + " <b>" + d.who + "</b> " + d.msg).join("<br>")
      : "锛堟殏鏃犲喅绛栬褰曪級";
  }

  const ds = E0 ? E0.dietStarling : 0, dg = E0 ? E0.dietGoose : 0, tot = ds + dg;
  el("dietS").style.width = (tot ? ds / tot * 100 : 50) + "%";
  el("dietG").style.width = (tot ? dg / tot * 100 : 50) + "%";
  el("dietText").textContent = tot
    ? `妞嬮笩 ${ds} 鍙?路 闆?${dg} 鍙?路 褰撳墠鍋忓悜 ${dg >= ds ? "杩介泚锛堝ぇ鍒嗭級" : "杩芥楦燂紙濂芥姄锛?}`
    : "杩樻病寮€寮?;

  const secs = stats.steps / 60;
  // 瑙嗗浘涓庢€ц兘: 鎷嗘垚涓ゅ潡 鈥斺€?涓婂崐灞?鐪嬪緱瑙佺殑涓栫晫鐘舵€?, 涓嬪崐灞?鏈哄埗璁℃暟", 涓嶅啀鏄竴鏁村潹鏂囧瓧
  el("viewLine").innerHTML =
    `<b>${VIEW3D ? "涓夌淮" : "淇"}</b> 路 閲嶅姏 <b>${GRAV_ON ? "寮€" : "鍏?}</b>` +
    ` 路 鐩告満 ${cam.dist.toFixed(0)}px${cam.auto ? "(鑷姩鐜粫)" : ""}` +
    ` 路 鎷栧熬 ${TRAIL3_ON ? "寮€" : "鍏?}` +
    ` 路 涓栫晫 ${W}脳${H}(瑙嗗彛 ${VIEW_W}脳${VIEW_H}, 鍘屾伓 ${BOUND_R}px)` +
    ` 路 娓叉煋 ${VIEW3D ? (gl3dReady ? "WebGL路3D" : "杞覆鏌撀?D") : (glReady ? "WebGL" : "Canvas2D")}${want2D ? "(寮哄埗)" : ""}` +
    ` 路 璁＄畻 ${gpuCompute ? "WebGPU" : "CPU"}${computeMode === "cpu" ? "(寮哄埗)" : ""}`;
  el("fpsLine").innerHTML =
    `FPS <b>${fpsEma.toFixed(0)}</b> 路 妯℃嫙 ${secs.toFixed(0)}s 路 step ${perf.stepMs.toFixed(1)}ms 路 render ${perf.renderMs.toFixed(2)}ms` +
    (gpuCompute ? `锛堜笂琛?${perf.uploadMs.toFixed(1)} + GPU ${perf.gpuMs.toFixed(1)} + 鍥炶 ${perf.readbackMs.toFixed(1)}锛塦 : "") +
    ` 路 鎬绘崟鑾?<b>${stats.kills}</b>锛?{(stats.kills / Math.max(secs, 1) * 60).toFixed(1)}/鍒嗭級路 琛ュ厖 ${stats.wave} 娉?br>` +
    `绌哄啿鍒?${stats.missFalcon}+${stats.missEagle} 路 绐佸洿鎵撴柇 ${stats.mobInterrupts} 路 閿佸畾鍐插埡 ${stats.lockedDashes}` +
    ` 路 鏃犵洰鏍囨斁寮?${stats.noLockAborts} 路 浜掓敾 ${stats.clashes}锛堟姠鍒?${stats.steals}锛?路 蔚=${E0 ? E0.eps.toFixed(2) : "鈥?}<br>` +
    `闆? 棰嗛槦 #${leaderIdx} 路 娣蜂贡 ${disarray} 路 骞奸泚 ${juvenileAlive()}/${juvCount}` +
    `${gooseDebuff > 0 ? " (娌抚 " + gooseDebuff + ")" : ""} 路 鍊熺綉棰勮 ${stats.gooseAlerts}锛堣鎶?${stats.gooseFalseAlerts}锛壜?鏂╅ ${stats.gooseDisarray}<br>` +
    `闅肩瓥: 浠ｆ暟 ${falcons[0] ? falcons[0].policy.gen : "鈥?}/${falcons[1] ? falcons[1].policy.gen : "鈥?}` +
    ` 路 閿ュ唴澶辫 ${stats.coneFalconFrames}+${stats.coneEagleDrain} 路 ES 閲囩撼 ${stats.esAdopt}/${stats.esPeriods} 鏈?路 鍐崇瓥鏃ュ織 ${decN} 鏉;
  el("modeTag").textContent = TORUS ? "鐜潰" : "寮€闃斾笘鐣?;
  renderQ();
}

/* z 鑼冨洿涓庡案浣撴暟(闈㈡澘鐢? 涓?SIM.zRange/corpses 鍚屽彛寰? */
function SIMzRange() {
  let lo = 1e9, hi = -1e9, sum = 0, cnt = 0;
  for (let i = 0; i < N; i++) if (alive[i]) { const z = Z[i]; if (z < lo) lo = z; if (z > hi) hi = z; sum += z; cnt++; }
  let glo = 1e9, ghi = -1e9, gsum = 0, gcnt = 0;
  for (let i = 0; i < M; i++) if (galive[i]) { const z = Z2[i]; if (z < glo) glo = z; if (z > ghi) ghi = z; gsum += z; gcnt++; }
  return { starling: cnt ? { lo, hi, mean: sum / cnt } : null, goose: gcnt ? { lo: glo, hi: ghi, mean: gsum / gcnt } : null };
}
function corpseCount() {
  let c = 0;
  for (let k = 0; k < CORPSE_CAP; k++) if (cT[k] > 0) c++;
  return c;
}

// P2: 杩樻椿鐫€鍑犲彧骞奸泚
function juvenileAlive() {
  let c = 0;
  for (let i = 0; i < M; i++) if (galive[i] && isJuvenile(i)) c++;
  return c;
}

// P3: 鎶婁袱鍙毤鐨勭瓥鐣ユ墦鍥炲嚭鍘傝缃?璇勪及鏈?浠ｆ暟/閫傚簲搴︿竴璧峰綊闆?
function resetFalconPolicies() {
  for (const f of falcons) {
    f.policy = makePolicy();
    f.policy.score0 = f.score;
  }
  stats.esAdopt = 0; stats.esPeriods = 0;
}

el("btnFlocks").onclick = () => resetFlocks();          // 閲嶇疆楦熺兢(璁″垎淇濈暀)
el("btnPreds").onclick  = () => resetPredators();       // 閲嶇疆鐚涚 = 鍥炲埌榛樿缂栧埗(2 闅?+ 1 楣?
el("btnAddFalcon").onclick = () => spawnRaptor("falcon");   // 绗?7/8 杞? 绔嬪嵆澧炴彺涓€鍙毤
el("btnAddEagle").onclick  = () => spawnRaptor("eagle");    // 绗?7/8 杞? 绔嬪嵆澧炴彺涓€鍙拱(鐙珛 Q 琛?
el("btnFMinus").onclick = () => removeRaptor("falcon");     // 绗?8 杞? 涓€閿鍑忕紪鍒?el("btnFPlus").onclick  = () => spawnRaptor("falcon");
el("btnEMinus").onclick = () => removeRaptor("eagle");
el("btnEPlus").onclick  = () => spawnRaptor("eagle");
el("btnView").onclick = () => toggleView();
el("btnCamReset").onclick = () => { cam.yaw = 0.7; cam.pitch = 0.52; cam.dist = 950; };
el("cbGravity").onchange = e => { GRAV_ON = e.target.checked; };
el("cbAuto").onchange = e => { cam.auto = e.target.checked; };
/* 澧炴彺琛? 鏄剧ず褰撳墠鐚涚缂栧埗涓庡鎻磋€呯殑鍚堣鎴樻灉 */
function refreshRaidLine() {
  const nf = falcons.length, ne = eagles.length;
  let extraK = 0, extraS = 0;
  for (let i = 2; i < falcons.length; i++) { extraK += falcons[i].kills; extraS += falcons[i].score; }
  for (let i = 1; i < eagles.length; i++)  { extraK += eagles[i].kills;  extraS += eagles[i].score; }
  const base = `鐚涚缂栧埗: 闅?脳${nf} 路 楣?脳${ne}`;
  el("raidLine").textContent = (nf > 2 || ne > 1)
    ? base + `锛堝鎻?${nf - 2 + ne - 1} 鍙? 鎹曡幏 ${extraK} 路 寰楀垎 ${extraS}锛塦
    : base;
}
el("btnScore").onclick  = () => {                       // 娓呯┖璁″垎
  for (const f of falcons) { f.score = 0; f.kills = 0; f.dashEats = 0; }
  for (const E of eagles) { E.score = 0; E.kills = 0; E.dashEats = 0; E.dietStarling = 0; E.dietGoose = 0; }
  stats.kills = 0; stats.steps = 0; stats.wave = 0;
  stats.missFalcon = 0; stats.missEagle = 0; stats.mobInterrupts = 0;
  stats.lockedDashes = 0; stats.clashes = 0; stats.steals = 0;
};
el("btnBrain").onclick = () => {                        // 閲嶇疆楣拌剳(鎵€鏈夐拱鐨?Q 琛ㄤ竴璧锋竻)
  for (const E of eagles) {
    E.Q.fill(0);
    E.eps = EPS0;
    E.lastState = 0; E.lastAction = 0; E.pending = 0;
    E.dietStarling = 0; E.dietGoose = 0;
    E.curState = STATE_NONE; E.curAction = 2;
    E.hold = 0; E.holdState = STATE_NONE; E.holdAction = 2;
  }
};
el("btnPolicy").onclick = () => resetFalconPolicies();  // P3: 閲嶇疆闅肩瓥(鍥為粯璁ゅ弬鏁?
el("btnPause").onclick = () => {
  paused = !paused;
  el("btnPause").textContent = paused ? "缁х画锛堢┖鏍硷級" : "鏆傚仠锛堢┖鏍硷級";
  el("btnPause").classList.toggle("on", paused);
};
el("cbVision").onchange = e => showVision = e.target.checked;
el("cbForm").onchange   = e => showFormation = e.target.checked;
el("cbRefill").onchange = e => refillOn = e.target.checked;
el("cbTorus").onchange  = e => setGeometry(e.target.checked);
el("cbTrail").onchange  = e => { TRAIL3_ON = e.target.checked; };   // 绗?8 杞箣涓? 涓夌淮鎷栧熬寮€鍏?el("cbEat3D").onchange  = e => { EAT_3D = e.target.checked; };      // 绗?8 杞慨姝ｂ憿: 鍚冨垽鏄惁鍗?3D 鐞?el("rgN").oninput    = e => el("vN").textContent = e.target.value;
el("rgN").onchange   = e => setN(+e.target.value);
el("rgK").oninput    = e => { topoK = clamp(+e.target.value, 1, TOPO_MAX); el("vK").textContent = topoK; };
el("rgSpeed").oninput = e => { speedMul = +e.target.value; el("vSpeed").textContent = speedMul + "脳"; };

document.addEventListener("keydown", e => {
  const k = e.key.toLowerCase();
  if (k === " ") { e.preventDefault(); el("btnPause").onclick(); }
  else if (k === "h") setPanelHidden(!panelHidden, true);   // 鏀惰捣/灞曞紑鐘舵€佹爮
  else if (k === "r") resetFlocks();
  else if (k === "c") el("btnScore").onclick();
  else if (k === "f") { if (e.shiftKey) el("btnFMinus").onclick(); else el("btnAddFalcon").onclick(); }   // 绗?8 杞? 鈬 鍑忓憳
  else if (k === "e") { if (e.shiftKey) el("btnEMinus").onclick(); else el("btnAddEagle").onclick(); }     // 绗?8 杞? 鈬 鍑忓憳
  else if (k === "t") toggleView();                     // 绗?8 杞? 3D/淇鍒囨崲
  else if (k === "b") el("btnBrain").onclick();
  else if (k === "v") { el("cbVision").checked = !el("cbVision").checked; showVision = el("cbVision").checked; }
});

/* ---- GPU 璁＄畻璺緞(绗?1 姝ュ師鍨?: 6.1+6.2 鍦?GPU, 鍏朵綑浠嶈蛋 stepRest ---- */
async function stepGPU() {
  frame++; stats.steps++;
  const tor = TORUS;
  const r = await window.ComputeBackend.frame(computeScene);   // GPU: 缃戞牸 + 閭诲眳 + 姹傚姏 -> ACC
  perf.uploadMs = perf.uploadMs * 0.9 + r.uploadMs * 0.1;
  perf.gpuMs = perf.gpuMs * 0.9 + r.gpuMs * 0.1;
  perf.readbackMs = perf.readbackMs * 0.9 + r.readbackMs * 0.1;
  cpuCentroidOnly(tor);                                       // 6.3/6.4 闇€瑕佽川蹇?涓?CPU 鐗堝悓搴?
  stepRest(tor);                                              // 6.3 ~ 6.10
  return r;
}

let stepAcc = 0;
function loop() {
  const now = performance.now();
  fpsEma = fpsEma * 0.95 + (1000 / Math.max(now - lastT, 1)) * 0.05;
  lastT = now;
  tryInitGL();                                 // 棣栧抚鍐嶅垵濮嬪寲 GL(閭ｆ椂绗簩涓?script 宸茶В鏋?

  let stepMs = 0;
  if (!paused) {
    const t0 = performance.now();
    stepAcc += speedMul;                       // 鏃堕棿鍊嶉€? 涓€甯ц窇澶氭
    const nSteps = Math.min(Math.floor(stepAcc), 4);
    stepAcc -= nSteps;
    for (let s = 0; s < nSteps; s++) step();
    stepMs = (performance.now() - t0) / Math.max(nSteps, 1);   // 鍗曟鑰楁椂(闄や互姝ユ暟)
  }
  perf.stepMs = perf.stepMs * 0.9 + stepMs * 0.1;
  render();

  if (now - lastPanelT > 160) {                // 璁″垎鏉?~6Hz 鍒锋柊瓒冲
    lastPanelT = now;
    refreshPanel();
    if (diagMode && (++diagTicks % 6 === 0)) {  // ~1 绉掍竴琛? 缁欐棤澶?鐪熸満鍙栬瘉鐢?      console.info("DIAG " + JSON.stringify({
        backend: gpuCompute ? "webgpu" : "cpu", n: N, frame,
        fps: Math.round(fpsEma), stepMs: +perf.stepMs.toFixed(2), renderMs: +perf.renderMs.toFixed(2),
        uploadMs: +perf.uploadMs.toFixed(2), gpuMs: +perf.gpuMs.toFixed(2), readbackMs: +perf.readbackMs.toFixed(2),
        alive: aliveCount, galive: galiveCount, kills: stats.kills, deaths: stats.steps,
      }));
    }
  }
  requestAnimationFrame(loop);
}

/* GPU 甯у惊鐜? 姣忓抚 await 璁＄畻鍚庣(WebGPU 鎻愪氦鏄紓姝ョ殑, 涓荤嚎绋嬩笉鑳介樆濉炵瓑寰?
 * 鎵€浠?GPU 妯″紡涓嬫暣鏉″惊鐜彉鎴?async 鈥斺€?姣忓抚浠嶇劧鍙帹杩涗竴娆＄墿鐞? 璇箟涓?CPU 璺緞涓€鑷? */
let gpuFrameBusy = false;
async function loopGPU() {
  if (gpuFrameBusy) { requestAnimationFrame(loopGPU); return; }   // 闃查噸鍏?涓€甯т竴涓?await)
  gpuFrameBusy = true;
  const now = performance.now();
  fpsEma = fpsEma * 0.95 + (1000 / Math.max(now - lastT, 1)) * 0.05;
  lastT = now;
  tryInitGL();

  let stepMs = 0;
  if (!paused && window.ComputeBackend && window.ComputeBackend.ready()) {
    const t0 = performance.now();
    stepAcc += speedMul;
    const nSteps = Math.min(Math.floor(stepAcc), 4);
    stepAcc -= nSteps;
    for (let s = 0; s < nSteps; s++) {
      try { await stepGPU(); }
      catch (e) {                                  // 浠讳綍涓€娆″け璐ラ兘褰撳満闄嶇骇, 涓嶈鐢婚潰鍋滀綇
        console.warn("WebGPU 璁＄畻澶辫触, 閫€鍥?CPU 璺緞:", e && e.message);
        gpuCompute = false; perf.gl = perf.gl; computeMode = "cpu";
        step(); break;
      }
    }
    stepMs = (performance.now() - t0) / Math.max(nSteps, 1);
  } else if (!paused) {
    const t0 = performance.now();
    step();
    stepMs = performance.now() - t0;
  }
  perf.stepMs = perf.stepMs * 0.9 + stepMs * 0.1;
  render();
  if (now - lastPanelT > 160) {
    lastPanelT = now;
    refreshPanel();
    if (diagMode && (++diagTicks % 6 === 0)) {
      console.info("DIAG " + JSON.stringify({
        backend: gpuCompute ? "webgpu" : "cpu", n: N, frame,
        fps: Math.round(fpsEma), stepMs: +perf.stepMs.toFixed(2), renderMs: +perf.renderMs.toFixed(2),
        uploadMs: +perf.uploadMs.toFixed(2), gpuMs: +perf.gpuMs.toFixed(2), readbackMs: +perf.readbackMs.toFixed(2),
        alive: aliveCount, galive: galiveCount, kills: stats.kills, deaths: stats.steps,
      }));
    }
  }
  gpuFrameBusy = false;
  requestAnimationFrame(gpuCompute ? loopGPU : loop);
}

/* ---- 鍚姩 ---- */
recomputeGridSize();
resetFlocks();
resetPredators();

/* 鍚姩闂搁棬: compute=cpu 鐩存帴璧?CPU 寰幆; 鍚﹀垯鍏堣瘯 WebGPU(鍚嚜妫€), 澶辫触闈欓粯鍥為€€銆? * 銆愬繀椤绘帓鍒伴甯у啀璺戙€? 鏈嚱鏁板湪涓诲尯鍧楁眰鍊兼椂浼氬悓姝ユ墽琛? 鑰?WebGPU 鍚庣鍦ㄧ涓変釜
 * <script> 鍖哄潡閲? 閭ｆ椂杩樻病琚В鏋?鈥斺€?鐩存帴鏌?window.ComputeBackend 浼氭案杩滄嬁鍒? * undefined, auto 妯″紡灏辨案杩滈€€鍥?CPU(鐪熸満娴忚鍣ㄥ疄娴嬭俯鍒扮殑鍧?銆?*/
requestAnimationFrame(async function boot() {
  if (computeMode === "cpu") { requestAnimationFrame(loop); return; }
  const B = window.ComputeBackend;
  if (!B) {
    console.warn("WebGPU 璁＄畻鍚庣鑴氭湰缂哄け, 璧?CPU 璺緞");
    requestAnimationFrame(loop); return;
  }
  // 鍒濆鍖栧甫瓒呮椂: requestAdapter 涓囦竴鍗′綇涔熶笉鑳借鐢婚潰涓嶅惎鍔?榛樿 3 绉? ?initTimeout=ms 鍙皟)
  const ok = await Promise.race([
    B.init(computeScene),
    new Promise(res => setTimeout(() => res("timeout"), initTimeoutMs)),
  ]);
  if (ok === "timeout") {
    console.warn("WebGPU 鍒濆鍖栬秴鏃?" + initTimeoutMs + "ms), 鍏堟寜 CPU 璺緞璧锋");
    requestAnimationFrame(loop); return;
  }
  computeInitInfo = B.info();  if (!ok) {
    if (computeMode === "gpu") console.warn("compute=gpu 浣?WebGPU 涓嶅彲鐢?", computeInitInfo.reason, "-> 鍥為€€ CPU");
    else console.info("WebGPU 涓嶅彲鐢?" + computeInitInfo.reason + "), 璧?CPU 璺緞");
    requestAnimationFrame(loop); return;
  }
  // 鑷: 鍚屼竴鐘舵€佹瘮 CPU/GPU 鐨?ACC, 瓒呭樊灏遍€€鍥?CPU
  computeSelfCheck = await B.selfCheck(computeScene, computeScene.cpuForces);
  if (!computeSelfCheck.passed) {
    console.warn("WebGPU 鑷鏈€氳繃(maxAbs=" + computeSelfCheck.maxAbs.toExponential(2) +
                 ", 瓒呭樊 " + computeSelfCheck.bad + " 椤?, 閫€鍥?CPU 璺緞");
    B.dispose();
    requestAnimationFrame(loop); return;
  }
  gpuCompute = true;
  console.info("WebGPU 璁＄畻鍚敤: 6.1+6.2 涓?GPU, 鑷閫氳繃(maxAbs=" +
               computeSelfCheck.maxAbs.toExponential(2) + ")");
  requestAnimationFrame(loopGPU);
});

/* ---- 绗簩涓?<script> 閲岀殑 WebGL 鍚庣: 寤惰繜鍒扮涓€甯у啀鍒濆鍖?閭ｆ椂瀹冨凡瑙ｆ瀽瀹? ---- */
function tryInitGL() {
  if (glTried) return;
  glTried = true;
  if (want2D) { console.info("render=2d: 璧?Canvas2D 鍏ㄨ矾寰?鐢ㄤ簬 A/B 瀵规瘮)"); return; }
  const B = window.GLBackend;
  if (!B) { console.warn("WebGL 鍚庣鑴氭湰缂哄け, 鍥為€€ Canvas2D"); return; }
  const ok = B.init(glScene, document.getElementById("glcv"), forceGL);
  glReady = !!ok;
  gl3dReady = glReady && !!(B.has3D && B.has3D());   // 绗?8 杞? 3D 绠＄嚎闅?2D 涓€璧峰垵濮嬪寲
  perf.gl = glReady;
  if (!ok) console.warn("WebGL 涓嶅彲鐢? 鍥為€€ Canvas2D 鍏ㄨ矾寰?);
  else {
    const gi = B.info();
    console.info("WebGL 瀹炰緥鍖栨覆鏌撳凡鍚敤: " + (gi && gi.gl2 ? "WebGL2" : "WebGL1+ANGLE") +
                 " 路 " + (gi ? gi.renderer : "?") + " 路 鏈€澶?" + (gi ? gi.maxN : "?") + " 鍙疄渚?);
  }
}

/* ---- 璋冭瘯/鑷姩鍖栭挬瀛?娴忚鍣ㄦ帶鍒跺彴鎴?headless 鏍￠獙鑴氭湰鍙敤) ---- */
window.SIM = {
  step, render, initStarlings, initGeese, resetFlocks, resetPredators, setGeometry, setN, perceive, refreshPanel,
  setPanelHidden,
  get panelHidden() { return panelHidden; },
  get N() { return N; },
  get M() { return M; },
  get frame() { return frame; },
  get TORUS() { return TORUS; },
  get PAD() { return PAD; },
  get aliveCount() { return aliveCount; },
  get galiveCount() { return galiveCount; },
  get scores() { return [falcons[0] ? falcons[0].score : 0, falcons[1] ? falcons[1].score : 0, eagles[0] ? eagles[0].score : 0]; },
  get kills() { return [falcons[0] ? falcons[0].kills : 0, falcons[1] ? falcons[1].kills : 0, eagles[0] ? eagles[0].kills : 0]; },
  get diet() { return [eagles[0] ? eagles[0].dietStarling : 0, eagles[0] ? eagles[0].dietGoose : 0]; },
  get stats() { return stats; },
  get Q() { return eagles[0] ? eagles[0].Q : new Float32Array(N_STATES * N_ACTIONS); },
  get eps() { return eagles[0] ? eagles[0].eps : 0; },
  get maxSpeed() { return MAX_SPEED; },
  get maxSpeedG() { return MAX_SPEED_G; },
  get leaderSpeed() { return LEADER_SPEED; },
  get leader() { return { x: Lx, y: Ly, ang: leaderAng, z: Z2[leaderIdx] }; },
  get topoK() { return topoK; },
  setTopoK(v) { topoK = clamp(v | 0, 1, TOPO_MAX); },
  setRefill(v) { refillOn = !!v; },
  setSpeed(v) { speedMul = v; },
  setPaused(v) { paused = !!v; },
  get hunterMob() { return [falcons[0] ? falcons[0].mob : 0, falcons[1] ? falcons[1].mob : 0, eagles[0] ? eagles[0].mob : 0]; },
  get hunterStun() { return [falcons[0] ? falcons[0].stun : 0, falcons[1] ? falcons[1].stun : 0, eagles[0] ? eagles[0].stun : 0]; },
  get hunterLock() { return [falcons[0] ? falcons[0].lockIdx : -1, falcons[1] ? falcons[1].lockIdx : -1, eagles[0] ? eagles[0].lockIdx : -1]; },
  get eatR2() { return [EAT_R2_S, EAT_R2_G]; },
  get flockConsts() { return { PERCEPTION, COHESION_W, ALIGNMENT_W, MAX_FORCE, SEP_R2 }; },
  get mobConsts() { return { MOB_FRACTION, MOB_R, MOB_HARASS, MOB_MAX, MOB_DRAIN_PER, MOB_PENALTY_N }; },
  get mobberCount() { let c = 0; for (let i = 0; i < N; i++) if (alive[i] && isMobber[i]) c++; return c; },
  get actionCols() { return N_ACTIONS; },
  // 绗?7 杞? 涓綋浣撶Н涓庨棿璺?楠屾敹/鍥炲綊鐢?, 浠ュ強"鍔犲叆楣?闅?鐨勭紪绋嬫帴鍙?  get bodySizes() { return { starling: BODY_S.slice(), goose: BODY_G.slice(), falcon: BODY_F.slice(), eagle: BODY_E.slice() }; },
  get spacing() { return { PERCEPTION, SEP_R2, GSEP_R2, CELL }; },
  get raptorCount() { return { falcons: falcons.length, eagles: eagles.length, total: raptors.length }; },
  get raidKills() { return raptors.map(r => r.kills); },
  addFalcon: () => spawnRaptor("falcon"),
  addEagle: () => spawnRaptor("eagle"),
  get raidLine() { return el("raidLine").textContent; },
  get maxN() { return MAXN; },
  get gw() { return GW; },
  get gh() { return GH; },
  // 鎬ц兘: 姣忓抚鎸囨暟婊戝姩骞冲潎(娓叉煋鍚庣楠屾敹鐢?
  get perf() { return { stepMs: perf.stepMs, renderMs: perf.renderMs, gl: perf.gl,
                        uploadMs: perf.uploadMs, gpuMs: perf.gpuMs, readbackMs: perf.readbackMs }; },
  // WebGPU 璁＄畻鍚庣(绗?6 杞?Phase 1+2B 鍘熷瀷): 鐘舵€?/ 鑷缁撴灉 / 鎵嬪姩鍒囨崲涓庢墜鍔ㄤ竴甯?  get compute() {
    return {
      requested: computeMode,
      backend: gpuCompute ? "webgpu" : "cpu",
      init: computeInitInfo,
      selfCheck: computeSelfCheck,
      ready: !!(window.ComputeBackend && window.ComputeBackend.ready()),
      info: window.ComputeBackend ? window.ComputeBackend.info() : null,
    };
  },
  accView: () => ACC,                            // 璋冭瘯/楠屾敹: 鐩存帴鐪?CPU 渚?ACC(鑷瀵规媿鐢?
  // 绗?8 杞? 鐚涚鍐崇瓥鏃ュ織 / 涓夌淮浣撶Н / 楂樺害鑼冨洿(楠屾敹鍙栬瘉鐢?
  log: (n) => decTail(n === undefined ? 30 : n),
  logTail: (n) => decTail(n === undefined ? 30 : n),
  get logCount() { return decN; },
  clearLog: () => { decN = 0; decHead = 0; },
  setSize3D: (m) => { SIZE3D_MUL = clamp(+m || 0, 0.5, 12); return SIZE3D_MUL; },
  get size3D() { return SIZE3D_MUL; },
  // 绗?8 杞箣涓? 涓夌淮楦熸嫋灏?寮€鍏?闀垮害/瀹藉害/閫忔槑搴?
  // 銆愮 8 杞慨姝ｂ懃銆戜笘鐣屼笌杈圭晫楠屾敹閽╁瓙 + 3D 鍚冨垽寮€鍏?涔嬪墠鍙姞浜嗗父閲? 蹇樹簡鍑哄彛)
  worldInfo: () => ({ worldW: W, worldH: H, viewW: VIEW_W, viewH: VIEW_H, torus: TORUS,
                     boundR: BOUND_R, clampCount: boundClamp, peakPenetration: boundPeak,
                     minEdgeDist: boundMinEdge === Infinity ? null : boundMinEdge }),
  resetBoundStats: () => { boundClamp = 0; boundPeak = 0; boundMinEdge = Infinity; return 1; },
  setEat3D: (v) => { EAT_3D = !!v; const cb = el("cbEat3D"); if (cb) cb.checked = EAT_3D; return EAT_3D; },
  get eat3D() { return EAT_3D; },
  setTrail3: (v, len, w, alpha) => {
    if (v !== undefined) TRAIL3_ON = !!v;
    if (len !== undefined) TRAIL3_LEN = clamp(+len, 0, 40);
    if (w !== undefined) TRAIL3_W = clamp(+w, 0.05, 4);
    if (alpha !== undefined) TRAIL3_ALPHA = clamp(+alpha, 0, 1);
    return { on: TRAIL3_ON, len: TRAIL3_LEN, w: TRAIL3_W, alpha: TRAIL3_ALPHA };
  },
  get trail3() { return { on: TRAIL3_ON, len: TRAIL3_LEN, w: TRAIL3_W, alpha: TRAIL3_ALPHA }; },
  // 绗?8 杞慨姝? 璇婃柇"鍔犲噺鐚涚鍚庡埆鍚嶆槸鍚︽寚鍚戞椿瀵硅薄"
  raptorRefs: () => ({ eagleIsLive: eagle === (eagles[0] || null), eagleNull: eagle === null,
                       falcons: falcons.map(f => f.label), eagles: eagles.map(E => E.label),
                       total: raptors.length, activeId }),
  get stoop() { return raptors.map(r => r.stoopT || 0); },
  get zRange() {
    let lo = 1e9, hi = -1e9, sum = 0, cnt = 0;
    for (let i = 0; i < N; i++) if (alive[i]) { const z = Z[i]; if (z < lo) lo = z; if (z > hi) hi = z; sum += z; cnt++; }
    let glo = 1e9, ghi = -1e9, gsum = 0, gcnt = 0;
    for (let i = 0; i < M; i++) if (galive[i]) { const z = Z2[i]; if (z < glo) glo = z; if (z > ghi) ghi = z; gsum += z; gcnt++; }
    return { starling: cnt ? { lo, hi, mean: sum / cnt } : null,
             goose: gcnt ? { lo: glo, hi: ghi, mean: gsum / gcnt } : null,
             zMeanLive, zLowLive, zHighLive };
  },
  get scene() { return { gravity: GRAV_ON, view3D: VIEW3D, camYaw: cam.yaw, camPitch: cam.pitch, camDist: cam.dist, camAuto: cam.auto }; },
  computeSceneRef: () => computeScene,
  async setCompute(mode) {                       // "cpu" | "gpu" | "auto": 绔嬪嵆灏濊瘯鍒囨崲
    computeMode = mode;
    if (mode === "cpu") { gpuCompute = false; return { backend: "cpu" }; }
    const B = window.ComputeBackend;
    if (!B) return { backend: "cpu", reason: "鍚庣鑴氭湰缂哄け" };
    if (!B.ready()) {
      const ok = await B.init(computeScene);
      computeInitInfo = B.info();
      if (!ok) return { backend: "cpu", reason: computeInitInfo.reason };
    }
    computeSelfCheck = await B.selfCheck(computeScene, computeScene.cpuForces);
    if (!computeSelfCheck.passed) { gpuCompute = false; return { backend: "cpu", selfCheck: computeSelfCheck }; }
    gpuCompute = true;
    return { backend: "webgpu", selfCheck: computeSelfCheck };
  },
  async selfCheckNow() {                         // 娴忚鍣ㄩ噷鎵嬪姩澶嶈窇涓€娆¤嚜妫€
    const B = window.ComputeBackend;
    if (!B || !B.ready()) return null;
    computeSelfCheck = await B.selfCheck(computeScene, computeScene.cpuForces);
    return computeSelfCheck;
  },
  async stepGPUOnce() {                          // 鎵嬪姩璺戜竴甯?GPU 璺緞(璋冭瘯)
    if (!window.ComputeBackend || !window.ComputeBackend.ready()) return null;
    const t0 = performance.now();
    await stepGPU();
    return { ms: performance.now() - t0, gpuMs: perf.gpuMs, uploadMs: perf.uploadMs, readbackMs: perf.readbackMs };
  },
  /* 娴忚鍣ㄤ晶娴嬮€? 杩炶窇 frames 甯?GPU 璺緞, 杩斿洖鏁翠綋 step 涓庝笁娈?涓婅/GPU/鍥炶)鐨勪腑浣嶆暟銆?   * 鐢ㄦ硶(鎺у埗鍙?: await SIM.benchGPU(120) */
  async benchGPU(frames) {
    if (!window.ComputeBackend || !window.ComputeBackend.ready()) return { error: "WebGPU 鏈氨缁? " + (computeInitInfo && computeInitInfo.reason) };
    const f = frames || 120;
    const tot = [], up = [], gp = [], rd = [];
    for (let i = 0; i < f; i++) {
      const t0 = performance.now();
      const r = await stepGPU();
      tot.push(performance.now() - t0); up.push(r.uploadMs); gp.push(r.gpuMs); rd.push(r.readbackMs);
    }
    const med = a => { a = Array.from(a).sort((x, y) => x - y); return a[a.length >> 1]; };
    return { frames: f, n: N, stepMs: med(tot), uploadMs: med(up), gpuMs: med(gp), readbackMs: med(rd),
             cpuRestMs: med(tot) - med(up) - med(gp) - med(rd) };
  },
  get renderBackend() { return glReady ? "webgl" : (want2D ? "2d(forced)" : "2d(fallback)"); },
  initRenderBackend: () => { tryInitGL(); return glReady; },
  get glInfo() { return window.GLBackend ? window.GLBackend.info() : null; },
  // P2: 闆佺兢涓績鍖栫姸鎬?楠屾敹鍒ゆ嵁 4/5/6 鐢?
  get geeseInfo() {
    return { leaderIdx, shift: gooseShift, disarray, debuff: gooseDebuff,
             juvenileAlive: juvenileAlive(), juvenileTotal: juvCount,
             apexAlive: !!galive[leaderIdx], galiveCount,
             apexX: Lx, apexY: Ly, leaderAng,
             alerts: stats.gooseAlerts, falseAlerts: stats.gooseFalseAlerts,
             disarrayCount: stats.gooseDisarray };
  },
  // P3: 涓ゅ彧闅肩殑绛栫暐鍙傛暟(瀹為檯鍊?涓庝笂涓€鏈熼€傚簲搴?  get falconPolicies() {
    return falcons.map((f, k) => {
      const v = policyVals({ policy: { evalP: f.policy.p } });
      return { id: k, normalized: Array.from(f.policy.p), vals: v,
               gen: f.policy.gen, periods: f.policy.periods,
               baseFit: f.policy.baseFit, lastFit: f.policy.lastFit,
               isCand: f.policy.isCand, score: f.score };
    });
  },
  resetFalconPolicies,
  killGoose: gooseDies,                    // 璋冭瘯/楠屾敹: 鎵嬪姩骞叉帀涓€鍙泚(璧扮湡瀹炴浜℃祦绋?
  slotOf: i => (i + gooseShift) % M,
  slotRankArm: i => ({ rank: slotRank[(i + gooseShift) % M], arm: slotArm[(i + gooseShift) % M] }),
  isJuvenile,
  get esConst() { return { ES_EVAL_FRAMES, ES_SIGMA, ES_MISS_WEIGHT, ES_METAB_WEIGHT, ES_NP }; },
  setEvalFrames(v) { esEvalOverride = v; },
  // ---- 浠诲姟0: 涓€娆℃€х墿鐞嗗熀鍑?娴忚鍣ㄦ帶鍒跺彴鎴?headless 閮界敤杩欎竴涓叆鍙? ----
  // 鐢ㄦ硶: SIM.bench()  鎴? SIM.bench(300, [2000,5000,10000,20000])
  // 杩斿洖姣忔。鐨勬瘡甯?step 鑰楁椂鍒嗗竷(鍙皟 step(), 瀹屽叏涓嶇 render)
  bench(steps, ns) {
    const list = ns && ns.length ? ns : [2000, 5000, 10000, 20000];
    const out = [];
    const keepN = N;
    for (const n of list) {
      setN(n);
      for (let i = 0; i < 30; i++) step();            // 棰勭儹(璁?JIT 绋冲畾)
      const times = new Float64Array(steps);
      for (let i = 0; i < steps; i++) {
        const t0 = performance.now();
        step();
        times[i] = performance.now() - t0;
      }
      const sorted = Array.from(times).sort((a, b) => a - b);
      const med = sorted[steps >> 1];
      const p90 = sorted[Math.min(steps - 1, Math.floor(steps * 0.9))];
      const p99 = sorted[Math.min(steps - 1, Math.floor(steps * 0.99))];
      const mean = sorted.reduce((a, b) => a + b, 0) / steps;
      out.push({ n, steps, median: +med.toFixed(3), p90: +p90.toFixed(3), p99: +p99.toFixed(3),
                 mean: +mean.toFixed(3), min: +sorted[0].toFixed(3) });
    }
    setN(keepN);
    return out;
  },
  // P1: 閲囨牱鐩爣鑾峰彇鐨勭洿鎺ュ叆鍙?璋冭瘯/楠屾敹鐢?
  probe: (x, y, vx, vy, r) => perceive(x, y, vx, vy, r * r),
  inCone,
  // P4: 鎯婇缃戣妯?闆佽兘"鐪嬪埌"澶氬皯鏉￠璀?
  get startledCount() { let c = 0; for (let i = 0; i < N; i++) if (alive[i] && startled[i]) c++; return c; },
  get startledRatio() { return aliveCount ? this.startledCount / aliveCount : 0; },
  get pvConst() { return { PV_ALERT_COS, ALERT_R, ALERT_N, ALERT_FALSE_R }; },
  get samplingConst() { return { radii: SAMPLE_RADII.slice(), angles: SAMPLE_ANGLES, SCOOP_R, LOCK_R, DIR_LAG }; },
  // 楠屾敹鐢? 鎶婁笁鍙寷绂芥尓鍒拌繙瑙?鍙瘡甯ц皟鐢? 妯℃嫙"鏃犵寷绂藉共鎵?鐨勯笩缇?
  parkRaptors(x = -PAD - 40, y = -PAD - 40) {
    for (const r of raptors) {
      r.x = wrapX(x); r.y = wrapY(y); r.vx = 0; r.vy = 0;
      r.dashT = 0; r.energy = ENERGY_MAX; r.memT = -1e9; r.seeing = false;
    }
  },
  starling(i) { return { x: P[2*i], y: P[2*i+1], z: Z[i], vx: V[2*i], vy: V[2*i+1], vz: VZ[i], alive: !!alive[i], mobber: !!isMobber[i] }; },
  goose(i) { return { x: P2[2*i], y: P2[2*i+1], z: Z2[i], alive: !!galive[i] }; },
  hunter(i) {
    const h = raptors[i];
    return { x: h.x, y: h.y, z: h.z, vx: h.vx, vy: h.vy, vz: h.vz || 0, energy: h.energy || 0, dashT: h.dashT || 0,
             mob: h.mob || 0, stun: h.stun || 0, lockIdx: h.lockIdx === undefined ? -1 : h.lockIdx,
             score: h.score, dashEats: h.dashEats || 0 };
  },
  // 绗?8 杞? 瑙嗚/閲嶅姏/鍑忓憳 缂栫▼鎺ュ彛
  get view3D() { return VIEW3D; },
  setView3D(v) { if (!!v !== VIEW3D) toggleView(); },
  get gravity() { return GRAV_ON; },
  setGravity(v) { GRAV_ON = !!v; const cb = el("cbGravity"); if (cb) cb.checked = GRAV_ON; },
  removeFalcon: () => removeRaptor("falcon"),
  removeEagle: () => removeRaptor("eagle"),
  get corpses() { let c = 0; for (let k = 0; k < CORPSE_CAP; k++) if (cT[k] > 0) c++; return c; },
  cam,
};

