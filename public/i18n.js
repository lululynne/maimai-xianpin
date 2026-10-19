'use strict';
// Presentation-only localization: API data, selected IDs, identities, prices and
// timers keep their original values. Switching does not recreate a form or card.
(() => {
  const foods = {
    '麦辣鸡腿汉堡三件套': 'Spicy Chicken Burger Meal', '麦辣鸡腿汉堡': 'Spicy Chicken Burger',
    '麦辣鸡腿堡双人餐': 'Spicy Chicken Burger Meal for Two', '麦辣鸡腿堡': 'Spicy Chicken Burger',
    '龙焰芝士棒鸡腿堡三件套': 'Dragon Flame Cheese Chicken Burger Meal', '龙焰芝士棒鸡腿堡': 'Dragon Flame Cheese Chicken Burger',
    '龙焰鸡腿堡三件套': 'Dragon Flame Chicken Burger Meal', '龙焰鸡腿堡': 'Dragon Flame Chicken Burger',
    '麦香鱼套餐': 'Filet-O-Fish Meal', '麦香鱼': 'Filet-O-Fish',
    '麦香鸡套餐': 'McChicken Meal', '麦香鸡': 'McChicken',
    '巨无霸三件套': 'Big Mac Meal', '巨无霸': 'Big Mac',
    '板烧鸡腿堡三件套': 'Grilled Chicken Burger Meal', '板烧鸡腿堡': 'Grilled Chicken Burger',
    '双层吉士汉堡套餐': 'Double Cheeseburger Meal', '双层吉士汉堡': 'Double Cheeseburger',
    '吉士汉堡包套餐': 'Cheeseburger Meal', '吉士汉堡包': 'Cheeseburger', '汉堡包': 'Hamburger',
    '不素之霸双层牛堡三件套': 'Double Beef & Sausage Burger Meal', '不素之霸双层牛堡': 'Double Beef & Sausage Burger',
    '培根蔬萃双层牛堡三件套': 'Bacon & Veg Double Beef Burger Meal', '培根蔬萃双层牛堡': 'Bacon & Veg Double Beef Burger',
    '培根安格斯厚牛堡三件套': 'Bacon Angus Beef Burger Meal', '培根安格斯厚牛堡': 'Bacon Angus Beef Burger',
    '芝士安格斯厚牛堡三件套': 'Cheese Angus Beef Burger Meal', '芝士安格斯厚牛堡': 'Cheese Angus Beef Burger',
    '双层深海鳕鱼堡三件套': 'Double Fish Burger Meal', '原味双层深海鳕鱼堡': 'Double Fish Burger',
    '开心亲子双人餐': 'Family Meal for Two', '开心乐园双人餐': 'Happy Meal for Two',
    '满分厚松饼堡双人餐': 'McMuffin & Pancake Burger Meal for Two',
    '一早现磨 超值二件套': 'Morning Coffee Value Duo',
    '脆香油条豆浆组合': 'Youtiao & Soy Milk Combo', '油条豆浆早餐分享组合': 'Youtiao & Soy Milk Breakfast to Share',
    '猪柳蛋麦满分早安双人餐': 'Sausage & Egg McMuffin Breakfast for Two', '猪柳蛋麦满分': 'Sausage & Egg McMuffin',
    '原味板烧鸡腿麦满分': 'Grilled Chicken McMuffin', '吉士蛋麦满分': 'Egg & Cheese McMuffin',
    '巧克力味厚松饼猪柳堡': 'Chocolate Pancake & Sausage Burger', '枫糖风味厚松饼猪柳堡': 'Maple Pancake & Sausage Burger',
    '芝芝火腿扒堡组合': 'Cheese & Ham Patty Burger Combo', '芝芝火腿扒堡': 'Cheese & Ham Patty Burger',
    'Hold不住鸡排堡（椒盐风味）': 'Salt & Pepper Chicken Burger',
    '大堡口福三件套': 'Big Burger Value Meal', '精选单人餐三件套': 'Classic Meal for One',
    '牛气满满套餐': 'Beef Lovers Meal', '酥脆无双套餐': 'Crispy Duo Meal',
    '“堡”你欢乐套餐': 'Burger Joy Meal', '“苹”水相“鱼”套餐': 'Apple & Fish Meal',
    '“苹板”支撑Pro套餐': 'Apple & Grilled Chicken Pro Meal', '“辣”么快乐套餐': 'Spicy Happiness Meal',
    '“我就喜欢”鸡薯双全盒': 'Chicken & Potato Share Box',
    '堡堡随心拼（7件任选）': 'Mix & Match Burger Box (7 items)',
    'BFF四宫格小食盘': 'BFF Four-Snack Platter', '蘸酱BFF四宫格小食盘': 'BFF Four-Snack Platter with Dips',
    '下午茶甜品分享餐': 'Afternoon Dessert Sharing Meal', '营养卷三人餐': 'Chicken Wrap Meal for Three',
    '营养鸡肉卷': 'Chicken Wrap', '薄皮V翅双拼十翅': 'Mixed Crispy Wings (10 pcs)', '薄皮焦香V翅': 'Crispy Wings',
    '麦乐鸡鸡翅分享盒组合': 'Nuggets & Wings Share Box', '麦乐鸡套餐': 'Chicken McNuggets Meal',
    '麦乐鸡（10块）': 'Chicken McNuggets (10 pcs)',
    '麦乐鸡-4块': 'Chicken McNuggets (4 pcs)', '麦乐鸡4块': 'Chicken McNuggets (4 pcs)',
    '麦乐鸡-5块': 'Chicken McNuggets (5 pcs)', '麦乐鸡5块': 'Chicken McNuggets (5 pcs)', '5块麦乐鸡': 'Chicken McNuggets (5 pcs)',
    '麦辣鸡翅4块套餐': 'Spicy Wings Meal (4 pcs)', '麦辣鸡翅（4块）': 'Spicy Wings (4 pcs)',
    '麦辣鸡翅4块': 'Spicy Wings (4 pcs)', '麦辣鸡翅-2块': 'Spicy Wings (2 pcs)', '麦辣鸡翅2块': 'Spicy Wings (2 pcs)',
    '麦麦脆汁鸡-琵琶腿': 'Juicy Crispy Chicken Drumstick',
    '中杯可口可乐': 'Coca-Cola (Medium)', '可乐中杯': 'Coca-Cola (Medium)', '无糖可口可乐中杯': 'Coca-Cola Zero (Medium)',
    '中杯雪碧': 'Sprite (Medium)', '怡泉柠檬气泡水': 'Schweppes Lemon Sparkling Water',
    '中薯条': 'Fries (Medium)', '大薯条': 'Fries (Large)', '小薯条': 'Fries (Small)', '迷你薯条': 'Mini Fries',
    '脆薯饼': 'Hash Brown', '5块心形薯饼': 'Heart-Shaped Potato Bites (5 pcs)',
    '小杯玉米杯': 'Sweet Corn (Small)', '苹果片一袋(60g)': 'Apple Slices (60 g)',
    '纯牛奶': 'Milk', '热豆浆': 'Hot Soy Milk', '优品豆浆大杯': 'Soy Milk (Large)', '脆香油条': 'Crispy Youtiao',
    '鲜萃冰咖': 'Iced Coffee', '鲜萃冰美式': 'Iced Americano', '麦咖啡™冰美式中杯': 'McCafé Iced Americano (Medium)',
    '锡兰红茶': 'Ceylon Black Tea', '柠檬红茶': 'Lemon Black Tea', '美汁源橙汁': 'Minute Maid Orange Juice',
    '原味甜筒': 'Vanilla Cone', '麦旋风': 'McFlurry', '甜酸酱': 'Sweet & Sour Sauce', '韩式烟熏芝士风味酱': 'Korean Smoky Cheese Sauce',
    '海绵宝宝×航海王系列玩具': 'SpongeBob × One Piece Toy', '开心乐园玩具': 'Happy Meal Toy',
  };
  const places = {
    '麦当劳中山三乡谷都大道得来速餐厅': 'McDonald’s Gudu Avenue Drive-Thru, Zhongshan',
    '麦当劳中山三乡餐厅': 'McDonald’s Sanxiang, Zhongshan',
    '麦当劳中山新天地餐厅': 'McDonald’s Xintiandi, Zhongshan',
    '麦当劳中山神湾大道餐厅': 'McDonald’s Shenwan Avenue, Zhongshan',
    '中山三乡谷都大道得来速餐厅': 'Gudu Avenue Drive-Thru', '中山三乡餐厅': 'Sanxiang',
    '中山新天地餐厅': 'Xintiandi', '中山神湾大道餐厅': 'Shenwan Avenue',
    '三乡镇文昌路壹加壹商业大厦首层部分': 'Ground floor, Yijia Yi Commercial Building, Wenchang Road, Sanxiang',
    '三乡镇平南村金庄路8号骏豪名居13卡、14卡、15卡、16卡': 'Units 13–16, Junhao Mingju, 8 Jinzhuang Road, Pingnan, Sanxiang',
    '三乡镇雅居乐新城二期商业广场D栋顺昌购物广场一楼': 'Ground floor, Shunchang Shopping Plaza, Block D, Agile New Town Phase II, Sanxiang',
    '神湾镇神湾大道215号103、104、105、106卡商铺': 'Units 103–106, 215 Shenwan Avenue, Shenwan',
  };
  const exact = {
    '麦麦现拼 · 同店的人，一起吃刚刚好': 'MaiMai Share · Share a combo at the same restaurant',
    '麦麦现拼 · 独立参赛作品': 'MaiMai Share · Independent contest project',
    '麦麦': 'MaiMai ', '现拼': 'Share', '麦麦现拼': 'MaiMai Share',
    '新鲜拼单 · 省钱满足 · 现场即取': 'Share a combo · Split the cost · Pick up in store',
    '在线试玩 · 独立模拟': 'Try the demo', '演示模式 · 真实菜单快照': 'Demo · Captured real menus',
    '连接中': 'Loading', '实时菜单': 'Live menu',
    '一份大套餐，拼单享美味': 'One combo. More to share.',
    '刚好同一家店，': 'Same restaurant,', '一起拼': 'one combo, ', '刚刚好。': 'just right.',
    '大套餐一个人吃不完？': 'Too much food for one?',
    '和同店的人拼一份，各取所需，少一点浪费。': 'Share with someone at the same restaurant. Pick what you want, waste less.',
    '只到店自取': 'In-store pickup', '各自选餐品': 'Pick your items', '算清每人那份': 'Split the cost',
    '戴小帽子拿薯条的小粉水母': 'A little pink jellyfish holding fries', '拼拼大使': 'Sharing buddy',
    '一人吃不完，两人刚刚好': 'One combo. Just right for two.',
    '菜单来自中国门店，价格为人民币；英文餐名为便于理解的译名。': 'Menus are from restaurants in China. Prices are in CNY; English item names are descriptive translations.',
    '先看看你在的这家店': 'Choose a restaurant', '选门店': 'Restaurants', '选择门店': 'Choose a restaurant',
    '正在查看门店…': 'Loading restaurants…', '暂时没有可用门店': 'No restaurants available yet',
    '发起拼单': 'Start a group', '拼单列表': 'Sharing groups', '店里正在拼': 'Join a group', '我的拼单': 'My groups', '拼单成功': 'Ready', '刷新': 'Refresh',
    '按截止时间排序，先帮快到点的那一单。': 'Closing soonest first. Help a group fill before time runs out.',
    '这些单子人已经凑齐，等着下单或取餐。': 'These groups are full and ready to order or collect.',
    '保留这张卡片，到店核对。取到提醒最多延迟 30 秒。': 'Keep your card for pickup. Status updates may take up to 30 seconds.',
    '现场拼，就三步': 'Share a combo in three steps', '找同店的人': 'Find someone nearby',
    '选好套餐，留一份给刚好也在的人。': 'Choose a combo and leave a share for someone at the same restaurant.',
    '确认各自那份': 'Confirm your share', '按单点价比例算钱；缺价格时会明确说明。': 'Split by individual item prices. Missing prices are clearly marked.',
    '到店对卡片取餐': 'Bring your card to collect',
    '拼满后发起人下单，出餐了在这里提醒大家，各自报取餐码取走自己那份。': 'Once the group is full, the host orders. Each person collects their share with their own code (simulated).',
    '演示版的下单、付款和优惠券都是模拟的，不会扣钱，价格以门店为准。': 'Demo orders, payments and coupons are simulated. No charges are made. Final store prices apply.',
    '查看 GitHub 项目 · ⭐ Star': 'View on GitHub · ⭐ Star',
    '关闭': 'Close', '选一个想拼的套餐': 'Choose a combo', '点选你自己要的那几样': 'Pick your own items',
    '没点到的留给拼友。每位拼友至少要留一件。': 'Leave at least one item for each person joining you.',
    '最多允许几人一起拼': 'How many people can join?', '赶时间，拼满就走': 'One person joins you', '等得起，更容易拼成': 'Up to two people join you',
    '多久后截止': 'When does the group close?', '发起后不能延长，到点自动结束招募。': 'The deadline is fixed. Joining closes when time runs out.',
    '留个昵称': 'Choose a nickname', '昵称': 'Nickname', '起个昵称': 'Your nickname',
    '手机尾号后四位': 'Last 4 phone digits', '只防重复，谁都看不到': 'Demo: any 4 digits',
    '先选一个套餐': 'Choose a combo first', '看看有没有相似拼单': 'Check similar groups',
    '是否确认下单？': 'Start this group?', '演示版：下单和付款都是模拟的，不会扣钱。': 'Demo only. Orders and payments are simulated; no charges are made.',
    '再看看': 'Go back', '确认下单': 'Confirm group', '还有跟你相似的拼单噢': 'Someone is sharing the same combo',
    '当前无人跟您有相似拼单': 'No matching groups yet', '点击直接完成拼单': 'View this group',
    '是否选择继续等待拼单？': 'Keep waiting or order on your own?', '单点下单（8.5 折）': 'Order solo (15% off)', '继续等待': 'Keep waiting',
    '若选择单点菜品，将选择给予您 8.5 折的单张优惠券即刻下单。': ' Order your items separately with a simulated 15% discount.',
    '付款结算': 'Checkout', '理想版模拟': 'Concept demo', '模拟付款': 'Simulate payment', '支付成功': 'Payment complete',
    '下单成功': 'Order placed', '模拟，不扣款': 'Simulated. No charge.', '拼单小卡片': 'Group card',
    '我的拼单小卡片': 'My group card', '他的拼单小卡片': 'Group details',
    '正在查看这家店的拼单…': 'Loading groups…', '正在核对套餐和单件价格…': 'Checking combo and item prices…', '正在查看这家店的套餐…': 'Loading combos…',
    '正在等人': 'Waiting for someone', '已拼满 · 出餐中': 'Group full · Ready to order', '已出餐 · 等待取餐': 'Order placed · Ready to collect',
    '已取完': 'All collected', '到点结束': 'Closed', '已截止': 'Closed', '等待取餐': 'Ready to collect',
    '我的卡片': 'My card', '拼！': 'Join!', '看看': 'View', '剩下': 'Available', '整套': 'Whole combo',
    '我出': 'My share', '每人约': 'Per person', '我发起的': 'Hosting', '我参与的': 'Joined', '示例': 'Sample',
    '你还没有参与拼单': 'You haven’t joined a group yet', '这家店还没有拼成的单': 'No completed groups here yet',
    '这家店还没人在拼': 'No groups here yet', '去看看店里的人正在拼什么。': 'See what others are sharing.', '当前无人跟您有相似拼单，来当第一个吧': 'Start the first group at this restaurant.',
    '主食': 'Main', '饮料': 'Drink', '小食': 'Side', '单点价暂缺': 'Item price unavailable', ' · 可特调': ' · Customizable',
    '点选你要的': 'Pick your items', '还差饮料或主食': 'Add a drink or main', '给拼友留一份主食': 'Leave a main for someone else',
    '给拼友多留一件': 'Leave another item to share', '至少选一件': 'Choose at least one item', '主食不能全拿走': 'Leave at least one main to share',
    '这家店当前未提供可查询的这个时段菜单，先展示已有快照和标为「示例」的体验套餐。': 'This period’s menu is unavailable for this restaurant. Showing earlier captures and clearly marked sample combos.',
    '这个时段还没有适合拆分的套餐，稍后再看看。': 'No shareable combos for this period yet. Please check again later.',
    '价格待核': 'Price pending', '参考价': 'Reference price', '示例参考价': 'Sample price', '套餐核价': 'Combo price',
    '部分单件缺单点价，整单按件数均分，零头归发起人': 'Some item prices are missing: split equally per item, with rounding assigned to the host',
    '按单点价占比分摊，算到分，零头归发起人': 'Split by item price, rounded to cents; the host receives the rounding difference',
    '单件价格有缺失：整单按餐品件数均分，零头归发起人。': 'Some item prices are missing. Split equally per item; rounding goes to the host.',
    '按每人单点价占比分摊套餐价，零头归发起人。': 'Split the combo price in proportion to each person’s item prices; rounding goes to the host.',
    '示例套餐：搭配和价格按麦当劳常见价位编的参考值，不是实时核价。': 'Sample combo: illustrative items and prices, not a live quote.',
    '我的取餐码': 'My pickup code', '我的尾号': 'My last 4 digits', '我这份': 'My share', '已确认': 'Confirmed',
    '待确认': 'Awaiting confirmation', '待本人确认': 'Awaiting their confirmation', '已取走': 'Collected', '已认领': 'Claimed', 'TA 出': 'Their share',
    '到柜台报这个码，只能取走你自己这份。': 'Show this code at the counter to collect your own share (simulated).',
    '下单后门店会给你一个只属于你的取餐码。': 'Your personal pickup code appears after the simulated order.',
    '同单拼友的尾号和取餐码只有本人和门店能看到，你只看得到昵称。': 'Other members’ phone digits and pickup codes are hidden from you.',
    '演示：模拟拼友加入并确认': 'Demo: add and confirm a partner', '复制我的小卡片': 'Copy my card',
    '确认我这份和金额': 'Confirm my items and amount', '拼满了，下单': 'Group full — place demo order', '我已下单': 'I have placed the order',
    '我已凭取餐码取走我这份': 'I have collected my share', '演示：模拟拼友取走 TA 那份': 'Demo: partner collects their share',
    '这单每个人都取走了自己那份，拼单完成。': 'Everyone has collected their share. This group is complete.',
    '我来拼剩下这份': 'Claim the remaining items', '加入这单，再核对金额': 'Join and review the amount',
    '演示：切到门店视角（只有门店看得到所有尾号和取餐码）': 'Demo: view the restaurant pickup list',
    '只有门店能看到这张表。每个码只对应自己那几样，凭一个码拿不走整份。': 'Concept restaurant view. Each code identifies one person’s items, not the entire combo.',
    '没拼成也不白等': 'A little something for waiting', '等拼补偿券 · 发起人专享': 'Waiting coupon · Host only',
    '等满 15 分钟送 2 元 · 等满 30 分钟还可选单点 8.5 折或继续等每样立减 1.5 元 · 每人每天一张 · 自己取消不给 · 理想版模拟，不是真券': 'After 15 min: CNY 2 coupon. After 30 min: order solo at 15% off, or keep waiting for CNY 1.50 off each item. One per person per day; no coupon after cancellation. Concept demo, not a real coupon.',
    '演示：快进到这单等满 31 分钟': 'Demo: skip to 31 minutes of waiting', '等满 30 分钟了：选继续等还是单点': '30 minutes passed: wait or order solo',
    '不等了，整套餐下单': 'Take the whole combo now', '不等了 · 整套餐下单': 'Taking the whole combo',
    '已改单点 · 8.5 折': 'Ordering solo · 15% off', '单点价暂缺，以门店为准': 'Item price unavailable; final store prices apply',
    '演示价，实际以门店结算为准': 'Demo amount; final store prices apply', '拿 8.5 折单张券，自己单点': 'Order your items solo with a simulated 15% discount',
    '已经有人加入你这单，不能改单点；可以继续等，或之后整套餐下单。': 'Someone has joined. Keep waiting or take the whole combo; solo ordering is no longer available.',
    '剩下的你包了：你这份按 8.5 折结算，同单拼友照原来的份额付，没有额外优惠': 'You take the rest. Your share gets a simulated 15% discount; partners pay their original shares.',
    '按件均分的份额': 'Share split equally per item', '按单点价比例分摊': 'Share based on item prices',
    '等拼补偿券': 'Waiting coupon', '整套餐下单 8.5 折': 'Whole-combo discount (15%)', '我应付': 'My total', '我这份应付': 'My total',
    '演示：点「模拟付款」不会扣款。': 'Demo only: simulating a payment does not charge you.',
    '本网页不收款：请在麦当劳官方 App / 小程序付款后，再回来点确认。': 'This page does not take payment. Pay through the official McDonald’s app, then confirm here.',
    '我已在官方 App 付款下单': 'I paid and ordered in the official app', '我已核对，确认我这份': 'Confirm my share',
    '8.5 折单张券已放进卡包（模拟），现在就能下单。': 'Your simulated 15% discount is ready for a solo order.',
    '发起人已经取到餐了，带上小卡片，到店对一下你的那份。': 'The group has collected its food. Keep your card for reference.',
    '到点了，这单已经下架。可以改成自己单点：': 'This group has closed. You can order your own items:',
    '价格暂缺': 'Price unavailable', '自己的可用券，请到麦当劳 App 查看。': 'Check the official McDonald’s app for your actual coupons.',
    '小卡片已复制': 'Card copied', '复制暂不可用，可以长按卡片文字保存。': 'Copy unavailable. You can select and save the card text.',
    '暂时没有连上，请重试': 'Could not load. Please try again.', '暂时没有连上。请刷新页面重试。': 'Could not load the demo. Please refresh and try again.',
    '菜单连接暂时不可用，请稍后重试': 'The menu connection is unavailable. Please try again later.',
    '菜单查询暂时不可用，请稍后重试': 'Could not load the menu. Please try again later.', '当前餐品暂不可用，请重新选一个套餐': 'This item is unavailable. Please choose another combo.',
    '演示没有采集这个选项，请选双人餐': 'This option was not captured. Please choose another combo.',
    '当前时段没有这个餐品': 'This item is unavailable for this period.', '这个餐品暂时无法拆分，请换一个套餐': 'This item cannot be shared. Please choose another combo.',
    '暂时核不到价格，请稍后重试': 'The price is unavailable. Please try again later.',
    '请填写昵称和尾号后四位': 'Enter a nickname and four phone digits.', '昵称限 1–20 个字': 'Use a nickname of 1–20 characters.',
    '昵称中不要填写完整手机号': 'Do not put a full phone number in your nickname.', '只填写手机尾号后四位': 'Enter exactly four digits.',
    '餐品已被选走，请刷新后重选': 'These items are no longer available. Refresh and choose again.',
    '规定时间须为 10–60 分钟': 'Choose a deadline between 10 and 60 minutes.',
    '一份套餐最多三人拼：发起人最多再允许 2 人加入': 'A combo can be shared by up to three people: the host and two others.',
    '请为其他每个人至少留一件餐品': 'Leave at least one item for each other person.',
    '选好自己那份，并为其他每个人至少留一件餐品。': 'Choose your items and leave at least one item for each other person.',
    '主食不能全拿走，至少给拼友留一份主食': 'Leave at least one main item for someone else.',
    '不能拼自己的单或重复加入': 'You cannot join your own group or join twice.', '同一尾号不能重复加入': 'Those four digits are already used in this group.',
    '十分钟内最多加入三单，请稍后再试': 'You can join up to three groups in ten minutes. Please try again later.',
    '最后一位需选完剩余餐品，其他情况请为每人至少留一件': 'The last person must take all remaining items. Otherwise, leave one item per person.',
    '只有本单成员可以操作': 'Only group members can do this.', '只有发起人可以操作': 'Only the host can do this.',
    '这单已结束，不能再确认': 'This group has ended and cannot be confirmed.', '等满 30 分钟后才能选择': 'This choice becomes available after 30 minutes.',
    '已经领过继续等待的立减': 'The waiting discount has already been applied.',
    '已经有人加入，不能改单点；可以选「不等了，整套餐下单」': 'Someone has joined. You can choose to take the whole combo instead.',
    '这单不能再移出成员': 'Members can no longer be removed.', '只能移出尚未确认的拼单人': 'Only unconfirmed partners can be removed.',
    '发起人还没下单': 'The host has not ordered yet.', '拼单不存在或已删除': 'This group no longer exists.',
    '这单已拼满或结束': 'This group is full or closed.', '这单快到点了，换一单演示': 'This group is closing soon. Try another demo group.',
    '只有本单成员可以打开演示的门店视角': 'Only members can open the demo counter view.', '还没下单，或这单已经取完': 'This order has not been placed, or everyone has collected it.',
    '请求格式不正确': 'Invalid request.', '服务暂时不可用，请稍后重试': 'Temporarily unavailable. Please try again later.',
    '请先确认相似拼单': 'Review similar groups before creating yours.', '没有这个页面': 'Page not found.',
    '移出': 'Remove', '待取': 'Not collected',
    '上新': 'New', '套餐': 'Combo', '小食拼盘': 'Snack platter', '开心亲子餐': 'Family meal', '粉丝之选': 'Fan favorite',
    '经典精选': 'Classic', '大口吃肉好快乐': 'For meat lovers',
  };
  const fragments = {
    ...exact, ...foods, ...places,
    '拼单时段': 'Sharing hours', '午市 ': 'Lunch ', '晚市 ': 'Dinner ',
    '演示模式按开放时段模拟': 'Demo is available at any time. Hours shown are Beijing time.',
    '拼单开放中': 'Groups are open', '现在不在拼单时段': 'Groups are closed', '下一场 ': 'Next session: ',
    ' 开放': ' opens', '明天 ': 'Tomorrow ', '8.5 折': '15% off',
    '规定时间不延长 · 套餐核价': 'Fixed deadline · Combo price', '规定时间不延长': 'Fixed deadline',
    '等待补偿归你，饮料的溢价也由你担；主食不能全拿走，给拼友留一份。': 'The host gets waiting perks and takes the drink costs. Leave at least one main for someone else.',
    '这是 ': 'This combo has ', ' 件的套餐：发起人至少拿 ': ' items. The host must take at least ',
    ' 份饮料 + ': ' drink(s) + ', ' 份主食': ' main item(s)',
    '我出约': 'My share ≈', '我实付约': 'My total ≈', '我出 ': 'My share ', 'TA 出 ': 'Their share ', '已认领 ': 'Claimed ',
    '继续等待立减': 'Waiting discount', '继续等待：立减': 'Keep waiting: save',
    '一人拿下整套：套餐': 'Taking the whole combo: price', ' − 立减 ': ' − discount ',
    '已为你立减': 'You save', '，拼成时自动抵扣（模拟）。': ', applied when the group fills (simulated).',
    '，已锁定': ', reserved', '演示价，实际以门店结算为准': 'Demo price; final store prices apply',
    ' · 到店自取': ' · In-store pickup', '预约用餐 ': 'Pickup time ', ' · 采集 ': ' · Captured ',
    ' · 示例内容，非 MCP 核价': ' · Sample, not an MCP price quote',
    '（发起人）': ' (Host)', '（按件均分）': ' (equal per item)', '（数量：': ' (qty: ', '）': ')',
    '单点 ': 'Item price ', '模拟付款 ': 'Simulate payment ', '整单 ': 'Whole combo ', ' 人拼成': ' people sharing',
    ' · 可特调': ' · Customizable', ' 参考价': ' reference', ' · 当前暂停营业': ' · Closed in this captured snapshot',
    '尾号 ': 'Last 4 digits: ', '门店 ': 'Restaurant: ', '分摊 ': 'My share: ', ' 截止': ' deadline (Beijing time)',
    ' 已出餐': ' is ready', ' 人齐了，等发起人下单。': ' is full. Waiting for the host to order.',
    '：每个人都取走了自己那份。': ': everyone has collected their share.',
    '，你的取餐码 ': ', your pickup code is ', '，到柜台报码取你那份': '. Show it to collect your share (simulated)',
    '麦麦拼单 · 全部取完': 'MaiMai Share · All collected', '麦麦拼单 · 拼满了': 'MaiMai Share · Group full',
    '麦麦拼单 · 已下单': 'MaiMai Share · Order placed', '麦麦拼单 · 到点下架': 'MaiMai Share · Group closed',
    '麦麦拼单 · 已改单点': 'MaiMai Share · Ordering solo', '麦麦拼单 · 继续等待': 'MaiMai Share · Keep waiting',
    '麦麦现拼 · ': 'MaiMai Share · ', '现在': 'Now', '待取': 'Not collected', '已取走': 'Collected',
    '按理想版': 'In the concept demo, ', '此处仅展示，不发券。': 'Display only; no actual coupons are issued.',
    '尚未达到补偿券档位': 'the waiting coupon is not available yet',
  };
  const replaceKeys = Object.keys(fragments).sort((a, b) => b.length - a.length);
  const patterns = [
    [/^还剩 (\d+:\d+)$/, (_, time) => `${time} left`],
    [/^(\d+:\d+) 后截止$/, (_, time) => `Closes in ${time}`],
    [/^⏱ 还剩 (\d+:\d+)$/, (_, time) => `⏱ ${time} left`],
    [/^还可加入 (\d+) 人$/, (_, n) => `${n} ${n === '1' ? 'spot' : 'spots'} left`],
    [/^最多允许 (\d+) 人一起拼单$/, (_, n) => `Up to ${n} more`],
    [/^最多 (\d+) 人$/, (_, n) => `Up to ${n} more`],
    [/^(\d+) 分钟$/, (_, n) => `${n} min`],
    [/^你这单已经等了 (\d+) 分钟$/, (_, n) => `You have waited ${n} minutes`],
    [/^已等待 (\d+) 分钟。等满 15 分钟，理想版会给发起人 2 元补偿券；等满 30 分钟会弹窗让你选单点 8.5 折或继续等待立减。$/, (_, n) => `Waited ${n} min. After 15 min, the host gets a simulated CNY 2 coupon. After 30 min, choose a solo order at 15% off or keep waiting for a discount.`],
    [/^你发起的「(.+)」已经等了 (\d+) 分钟。$/, (_, name, n) => `Your “${translateText(name)}” group has waited ${n} minutes.`],
    [/^按你拼的 (\d+) 样，每样 1.5 元。等的过程中也可以随时「不等了，整套餐下单」。$/, (_, n) => `Save CNY 1.50 on each of your ${n} items. You can also choose to take the whole combo while waiting.`],
    [/^你拼的 (\d+) 样里，每样立减 1.5 元(，已锁定)?$/, (_, n, locked) => `CNY 1.50 off each of your ${n} items${locked ? ', reserved' : ''}`],
    [/^拿 (\d+) 件 · 留 (\d+) 件给最多 (\d+) 位拼友$/, (_, a, b, c) => `${a} items for you · ${b} left for up to ${c} others`],
    [/^发起人至少 (\d+) 饮料 \+ (\d+) 主食$/, (_, a, b) => `Host: at least ${a} drink(s) + ${b} main(s)`],
    [/^允许 (\d+) 人时至少留 (\d+) 件$/, (_, a, b) => `Leave at least ${b} items for ${a} others`],
    [/^核价时间 (.+)，实际以门店价格为准。$/, (_, date) => `Price checked ${date} (Beijing time). Final store prices apply.`],
    [/^门店视角 · 一单 (\d+) 个取餐码$/, (_, n) => `Restaurant view · ${n} pickup codes`],
    [/^你这份已经取走，拼单对你来说已完成。还有 (\d+) 人会凭自己的取餐码去柜台取。$/, (_, n) => `You have collected your share. ${n} others will collect theirs with their own codes.`],
    [/^没拼成，送你 (\d+) 元补偿券（模拟），可以直接单点。$/, (_, n) => `The group did not fill. You get a simulated CNY ${n} waiting coupon for a solo order.`],
    [/^拼单只在午市 11:30–14:30、晚市 18:30–21:30 开放，下一场 (.+)$/, (_, next) => `Groups open 11:30–14:30 and 18:30–21:30 Beijing time. Next session: ${next.replace('明天', 'tomorrow')}.`],
  ];
  function translateText(value) {
    const raw = String(value ?? '');
    if (raw.includes('\n')) return raw.split('\n').map(translateText).join('\n');
    const core = raw.trim();
    let result = exact[core] ?? foods[core] ?? places[core];
    if (result === undefined && core.startsWith('@')) {
      const split = core.search(/[（·]/);
      result = split < 0 ? core : core.slice(0, split) + translateText(core.slice(split));
      result = result.replace(/^@演示拼友(\d+)/, '@Demo partner $1');
    }
    if (result === undefined && core.startsWith('演示模式') && core.includes('真实接口快照')) {
      const date = core.match(/最近采集 ([^）]+)/)?.[1] ?? '';
      result = `Demo · Captured menus from China${date ? ` (${date}, Beijing time)` : ''}. People and orders are fictional. No real orders or charges. Each visitor has a separate demo; records stay in this tab. Use any nickname and four digits.`;
    }
    if (result === undefined) for (const [pattern, replacement] of patterns) if (pattern.test(core)) { result = core.replace(pattern, replacement); break; }
    if (result === undefined) {
      result = core;
      for (const key of replaceKeys) if (result.includes(key)) result = result.split(key).join(fragments[key]);
      result = result.replace(/ · 共 (\d+) 件 · /g, ' · $1 items · ').replace(/ · (\d+) 人拼成/g, ' · $1 people sharing');
      result = result.replace(/正在拼单，缺(一|\d+)人拼/g, (_, n) => ` is sharing; ${n === '一' ? 1 : n} spot(s) left for `);
    }
    result = result.replace(/、/g, ', ');
    return raw.slice(0, raw.indexOf(core)) + result + raw.slice(raw.indexOf(core) + core.length);
  }
  function chooseLanguage(query, saved, preferred) {
    if (query === 'en' || query === 'zh') return query;
    if (saved === 'en' || saved === 'zh') return saved;
    return /^zh\b/i.test(preferred ?? '') ? 'zh' : 'en';
  }
  let language = 'zh';
  const api = { translateText, chooseLanguage, foodNames: Object.keys(foods), get language() { return language; }, text: value => language === 'en' ? translateText(value) : value };
  globalThis.MaiMaiI18n = api;
  if (typeof document === 'undefined') return;
  let saved;
  try { saved = localStorage.getItem('maimai-xianpin:language'); } catch {}
  language = chooseLanguage(new URL(location.href).searchParams.get('lang'), saved, navigator.language);
  try { localStorage.setItem('maimai-xianpin:language', language); } catch {}
  const textRecords = new WeakMap();
  const attributeRecords = new WeakMap();
  const skip = element => element?.closest('script,style,textarea,input,pre,code,[data-no-i18n]');
  const attributes = ['aria-label', 'placeholder', 'title', 'alt'];
  let observer;
  function synchronize() {
    observer?.disconnect();
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (skip(node.parentElement)) continue;
      let record = textRecords.get(node);
      if (!record || node.nodeValue !== record.output) record = { source: node.nodeValue, output: node.nodeValue };
      record.output = api.text(record.source);
      if (node.nodeValue !== record.output) node.nodeValue = record.output;
      textRecords.set(node, record);
    }
    for (const element of document.querySelectorAll('[aria-label],[placeholder],[title],[alt]')) {
      if (element.closest('[data-no-i18n]')) continue;
      let records = attributeRecords.get(element);
      if (!records) attributeRecords.set(element, records = {});
      for (const attr of attributes) if (element.hasAttribute(attr)) {
        const value = element.getAttribute(attr);
        let record = records[attr];
        if (!record || value !== record.output) record = { source: value, output: value };
        record.output = api.text(record.source);
        if (value !== record.output) element.setAttribute(attr, record.output);
        records[attr] = record;
      }
    }
    for (const button of document.querySelectorAll('[data-language]')) button.setAttribute('aria-pressed', String(button.dataset.language === language));
    observer?.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes });
  }
  function setLanguage(next) {
    if (!['zh', 'en'].includes(next)) return;
    language = next;
    try { localStorage.setItem('maimai-xianpin:language', next); } catch {}
    const url = new URL(location.href); url.searchParams.set('lang', next);
    history.replaceState(null, '', url);
    synchronize();
  }
  Object.assign(api, { setLanguage, refresh: synchronize });
  // Native dialogs make the header inert. Keep a compact switch inside each
  // dialog as well, so a draft can change language without being closed.
  for (const header of document.querySelectorAll('dialog .dialog-head,dialog .pay-top')) {
    const control = document.querySelector('.language-switch').cloneNode(true);
    control.classList.add('dialog-language');
    header.insertBefore(control, header.querySelector('.close'));
    header.querySelector('.close').autofocus = true;
  }
  document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => setLanguage(button.dataset.language)));
  observer = new MutationObserver(synchronize);
  synchronize();
})();
