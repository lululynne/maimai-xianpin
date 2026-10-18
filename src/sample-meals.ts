import type { Meal } from './catalog.js';

// 演示用「示例套餐」（梅宝 10-19 02:24 要的）：真菜单只抓到早餐，纳纳画的单品大多没机会出场。
// 这些套餐和价格是按麦当劳常见搭配和常见价位编的参考值，不是 MCP 实时核价；页面上一律标「示例」。
// 只在演示模式、且当前时段真实可拼套餐不足 10 个时出现；真菜单抓够了就自动让位。
type Line = [name: string, quantity: number, unitPriceCents: number];
const defs: { code: string; name: string; priceCents: number; lines: Line[] }[] = [
  { code: '8800000001', name: '麦辣鸡腿堡双人餐', priceCents: 6900, lines: [['麦辣鸡腿堡', 2, 2250], ['中薯条', 2, 1200], ['中杯可口可乐', 2, 950]] },
  { code: '8800000002', name: '麦乐鸡鸡翅分享盒组合', priceCents: 5900, lines: [['麦乐鸡（10块）', 1, 2200], ['麦辣鸡翅（4块）', 1, 1900], ['大薯条', 1, 1400], ['中杯雪碧', 2, 950]] },
  { code: '8800000003', name: '开心乐园双人餐', priceCents: 5500, lines: [['汉堡包', 2, 1200], ['中薯条', 1, 1200], ['开心乐园玩具', 2, 1000], ['美汁源橙汁', 1, 1000], ['纯牛奶', 1, 900]] },
  { code: '8800000004', name: '下午茶甜品分享餐', priceCents: 3900, lines: [['原味甜筒', 2, 600], ['麦旋风', 1, 1500], ['柠檬红茶', 1, 1100], ['怡泉柠檬气泡水', 1, 900]] },
  { code: '8800000005', name: '营养卷三人餐', priceCents: 7900, lines: [['营养鸡肉卷', 3, 1800], ['中薯条', 1, 1200], ['中杯可口可乐', 2, 950], ['鲜萃冰美式', 1, 1300]] },
  { code: '8800000006', name: '猪柳蛋麦满分早安双人餐', priceCents: 3600, lines: [['猪柳蛋麦满分', 2, 1300], ['脆薯饼', 2, 700], ['热豆浆', 1, 600], ['纯牛奶', 1, 900]] },
  { code: '8800000007', name: '油条豆浆早餐分享组合', priceCents: 2900, lines: [['脆香油条', 2, 500], ['热豆浆', 2, 600], ['巧克力味厚松饼猪柳堡', 1, 1500]] },
];

export function sampleMeals(now: number): Meal[] {
  return defs.map(d => ({
    code: d.code, name: d.name, image: '', menuPriceCents: d.priceCents, tags: ['示例'], sample: true,
    priceCents: d.priceCents, verifiedAt: now,
    parts: d.lines.flatMap(([name, quantity, unitPriceCents], li) => Array.from({ length: quantity }, (_, i) => ({ id: `s${li + 1}-${d.code}-${i}`, code: `${d.code}${li}`, name, unitPriceCents, supportModify: false }))),
  }));
}
