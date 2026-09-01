import type { GachaPoolConfig } from './gachaTypes';

export const DEFAULT_GACHA_POOL: GachaPoolConfig = {
  pool_id: 'pool_starlight_echo_01',
  pool_name: '「星穹遥响 · 遗落幻境」',
  banner_image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1000&auto=format&fit=crop',
  frame_overlay: '',
  spark_count: 80,
  spark_reward: {
    card_id: 'card_ssr_01',
    description: '限定 SSR「永恒之森 · 祈愿神子」保底兑换'
  },
  rates: {
    SSR: 0.018,
    SR: 0.132,
    R: 0.85
  },
  cards: [
    {
      id: 'card_ssr_01',
      name: '永恒之森 · 祈愿神子',
      rarity: 'SSR',
      card_image: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=800&auto=format&fit=crop',
      description: '倾听古树低语的翠羽祭司，能在狂澜中唤醒星辰之辉。',
      featured: true
    },
    {
      id: 'card_ssr_02',
      name: '极光巡礼 · 绯红女武神',
      rarity: 'SSR',
      card_image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop',
      description: '身披永冬极光之羽翼，剑锋所指之处尽皆破晓。',
      featured: true
    },
    {
      id: 'card_ssr_03',
      name: '暗夜主宰 · 虚空观测者',
      rarity: 'SSR',
      card_image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=800&auto=format&fit=crop',
      description: '掌握时间断层的魔导师，指尖流淌着群星湮灭的秘密。',
      featured: false
    },
    {
      id: 'card_sr_01',
      name: '晨曦斥候 · 灵狐少女',
      rarity: 'SR',
      card_image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop',
      description: '穿梭于晨雾与枫林之间的敏捷信使，手握能看破幻象的灵镜。',
      featured: true
    },
    {
      id: 'card_sr_02',
      name: '炼金工坊 · 奇迹机械师',
      rarity: 'SR',
      card_image: 'https://images.unsplash.com/photo-1519638399535-1b036603ac77?q=80&w=600&auto=format&fit=crop',
      description: '沉迷于齿轮与以太反应的天才发明家，腰间挂着爆炸性试剂。',
      featured: false
    },
    {
      id: 'card_sr_03',
      name: '苍蓝圣堂 · 誓约骑士',
      rarity: 'SR',
      card_image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=600&auto=format&fit=crop',
      description: '誓死捍卫结界的重装护卫，巨盾之上刻有古老的祝福铭文。',
      featured: false
    },
    {
      id: 'card_r_01',
      name: '探险学者 · 旅行笔记',
      rarity: 'R',
      card_image: 'https://images.unsplash.com/photo-1516339901601-2e1562986307?q=80&w=400&auto=format&fit=crop',
      description: '记录了大陆奇闻异事的厚重羊皮卷。',
      featured: false
    },
    {
      id: 'card_r_02',
      name: '以太结晶 · 辉光碎片',
      rarity: 'R',
      card_image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=400&auto=format&fit=crop',
      description: '蕴含微弱魔法能量的矿石原石。',
      featured: false
    },
    {
      id: 'card_r_03',
      name: '风行羽箭 · 精铁轻弓',
      rarity: 'R',
      card_image: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=400&auto=format&fit=crop',
      description: '见习猎手常用的轻便短弓。',
      featured: false
    },
    {
      id: 'card_r_04',
      name: '治愈药草 · 甘霖萃取液',
      rarity: 'R',
      card_image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=400&auto=format&fit=crop',
      description: '散发着清香的野地草药蒸馏液。',
      featured: false
    }
  ],
  buttons: [
    {
      id: 'btn_pull_1',
      label: '单次祈愿 (1抽)',
      type: 'pull_single',
      pullCount: 1,
      position: { x: 0.28, y: 0.86 },
      styleVariant: 'secondary'
    },
    {
      id: 'btn_pull_10',
      label: '十连祈愿 (10抽)',
      type: 'pull_ten',
      pullCount: 10,
      position: { x: 0.72, y: 0.86 },
      styleVariant: 'gold'
    },
    {
      id: 'btn_pool_details',
      label: '卡池详情',
      type: 'details',
      position: { x: 0.18, y: 0.08 },
      styleVariant: 'ghost'
    },
    {
      id: 'btn_pool_history',
      label: '抽卡记录',
      type: 'history',
      position: { x: 0.82, y: 0.08 },
      styleVariant: 'ghost'
    }
  ],
  cursor_style: {
    type: 'arrow',
    color: '#F59E0B',
    size: 24
  }
};
