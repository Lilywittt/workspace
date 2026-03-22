const { uniqueStrings } = require('./scene_design');

function compactText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*(?:\.|\u3002)+$/g, '')
    .trim();
}

function firstNonEmpty(values) {
  return (values || []).map(compactText).find(Boolean) || '';
}

function collectSourceText(scenePlan, captionBrief) {
  return [
    scenePlan?.lane,
    scenePlan?.sceneSemantics?.sceneProgramId,
    scenePlan?.sceneSemantics?.locationArchetype,
    ...(scenePlan?.sceneSemantics?.objectBindings || []),
    scenePlan?.sceneSemantics?.actionKernel,
    scenePlan?.sceneSemantics?.weatherRole,
    scenePlan?.sceneSemantics?.emotionalLanding,
    scenePlan?.narrative?.premise,
    ...(scenePlan?.narrative?.microPlot || []),
    scenePlan?.narrative?.sensoryFocus,
    ...(scenePlan?.visual?.concreteSceneCues || []),
    ...(captionBrief?.writingDirectives || []),
    captionBrief?.contentBlocks?.creativeSummary,
    ...(captionBrief?.contentBlocks?.hashtagAngles || [])
  ]
    .map(item => compactText(item))
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function inferWeatherPhrase(scenePlan) {
  const signal = String(scenePlan?.freshness?.weatherSignal || '').toLowerCase();
  if (/rain|drizzle|shower/.test(signal)) return '雨声';
  if (/snow/.test(signal)) return '冷冷的空气';
  if (/clear|sun|mostly clear/.test(signal)) return '亮一点的天光';
  if (/cloud|overcast/.test(signal)) return '灰灰的天色';
  if (/fog|mist/.test(signal)) return '雾蒙蒙的空气';
  return '今天的空气';
}

function inferFallbackProfile(scenePlan, captionBrief) {
  const raw = collectSourceText(scenePlan, captionBrief);
  const lane = String(scenePlan?.lane || 'life_record').trim();
  const locationName = compactText(scenePlan?.freshness?.locationName || '');
  const weatherPhrase = inferWeatherPhrase(scenePlan);
  const isStudyDesk = /desk|study|textbook|notebook|review session|laptop|lamp|paper|graphite|sketch|doodle|draw/.test(raw);
  const isRediscovery = /find|found|uncover|rediscover|forgotten|old|half-finished|crumpled/.test(raw);
  const isMirrorMood = /mirror|reflection|selfie|camera|front camera|phone camera/.test(raw) || lane === 'selfie';
  const isTransit = /train|station|platform|subway|metro|bus/.test(raw);
  const isStreet = /street|alley|crosswalk|shopfront|corner|city/.test(raw);

  if (lane === 'selfie' || isMirrorMood) {
    return {
      opening: `对着镜头停了一下`,
      action: `${weatherPhrase}把情绪压低了一点，我也跟着安静下来`,
      detail: '光线落在发梢和领口边缘的时候，表情比想象里更诚实',
      feeling: '有些状态不用解释，只要被轻轻记住就够了',
      hashtags: ['自拍', '今日状态', '日常', locationName ? `${locationName}日常` : '生活碎片']
    };
  }

  if (isStudyDesk || isRediscovery) {
    return {
      opening: '收拾书桌的时候',
      action: '从笔记本底下翻出一张以前画到一半的小草稿',
      detail: '纸页轻轻一响，指尖也蹭到一点铅灰',
      feeling: '像把前阵子随手放下的心情又捡回来了一点',
      hashtags: ['书桌日常', '学习碎片', '手绘涂鸦', '小发现', locationName ? `${locationName}日常` : '日常记录']
    };
  }

  if (isTransit) {
    return {
      opening: '路上等车的时候',
      action: `${weatherPhrase}把周围的节奏放慢了一点`,
      detail: '站台边缘的风和衣角一起轻轻动了一下',
      feeling: '本来很普通的通勤，也会突然变成值得记一下的小片段',
      hashtags: ['通勤碎片', '城市日常', '今日片段', locationName ? `${locationName}日常` : '生活记录']
    };
  }

  if (isStreet) {
    return {
      opening: '路过街上的一个小角落时',
      action: `${weatherPhrase}把周围的声音压低了一点`,
      detail: '脚步、灯光和一点点风，刚好都停在那个瞬间里',
      feeling: '这种很小的生活感，反而最像今天真正留下来的东西',
      hashtags: ['城市碎片', '生活切片', '今日片段', locationName ? `${locationName}日常` : '日常记录']
    };
  }

  return {
    opening: '今天被一个很小的细节拦住了',
    action: `${weatherPhrase}和日常动作碰在一起，忽然让心情慢下来一点`,
    detail: firstNonEmpty([
      scenePlan?.narrative?.sensoryFocus,
      scenePlan?.caption?.tone?.[0]
    ]) || '那个瞬间轻得像没发生过，却还是被我记住了',
    feeling: '有些日常不用很大声，也会自己留下来',
    hashtags: ['日常记录', '生活切片', '小心情', locationName ? `${locationName}日常` : '今日片段']
  };
}

function buildFallbackCandidates(scenePlan, captionBrief, maxHashtags = 5) {
  const profile = inferFallbackProfile(scenePlan, captionBrief);
  const hashtags = uniqueStrings([
    ...profile.hashtags,
    ...(captionBrief?.contentBlocks?.hashtagAngles || [])
      .map(angle => {
        const text = compactText(angle).toLowerCase();
        if (!text) return '';
        if (/study|desk/.test(text)) return '书桌日常';
        if (/anime|art|doodle|sketch/.test(text)) return '手绘涂鸦';
        if (/nostalgia|memory/.test(text)) return '旧心情';
        if (/weather/.test(text)) return '天气碎片';
        if (/city|shanghai/.test(text)) return '城市碎片';
        if (/life|slice-of-life/.test(text)) return '生活切片';
        return '';
      })
  ]).slice(0, Math.min(5, maxHashtags));

  return [
    {
      id: 'ai_cand_01',
      angle: 'daily_observation',
      caption: `${profile.opening}，${profile.action}。${profile.detail}，所以我想把这个小瞬间认真留给今天。`,
      hashtags,
      rationale: 'Lead from the concrete action and land on a soft daily observation.'
    },
    {
      id: 'ai_cand_02',
      angle: 'micro_plot',
      caption: `本来只是很普通地过着今天，结果${profile.action}。${profile.detail}，一下子就让今天有了可以回头看的理由。`,
      hashtags,
      rationale: 'Keep a cause-action-feeling arc while staying conversational.'
    },
    {
      id: 'ai_cand_03',
      angle: 'mood_first',
      caption: `${profile.detail}的时候，我忽然觉得${profile.feeling}。有时候一天最值得记下来的，真的就是这样一点点。`,
      hashtags,
      rationale: 'Start from mood but keep it tied to one readable detail.'
    }
  ];
}

function buildCaptionTaskInput(scenePlan, captionBrief, continuitySnapshot) {
  const recentOpenings = ((continuitySnapshot?.duplicateGuards?.recentOpenings) || [])
    .slice(0, 5)
    .map(item => compactText(item.value))
    .filter(Boolean);
  const frequentHashtags = ((continuitySnapshot?.duplicateGuards?.frequentHashtags) || [])
    .slice(0, 8)
    .map(item => compactText(item.value).replace(/^#+/, ''))
    .filter(Boolean);

  return {
    scene: {
      lane: scenePlan?.lane || 'life_record',
      sceneSemantics: scenePlan?.sceneSemantics || {},
      premise: compactText(scenePlan?.narrative?.premise || ''),
      microPlot: (scenePlan?.narrative?.microPlot || []).map(compactText).filter(Boolean).slice(0, 3),
      sensoryFocus: compactText(scenePlan?.narrative?.sensoryFocus || ''),
      weatherSignal: compactText(scenePlan?.freshness?.weatherSignal || ''),
      locationName: compactText(scenePlan?.freshness?.locationName || ''),
      concreteSceneCues: (scenePlan?.visual?.concreteSceneCues || []).map(compactText).filter(Boolean).slice(0, 5),
      tone: (scenePlan?.caption?.tone || []).map(compactText).filter(Boolean).slice(0, 6)
    },
    brief: {
      goal: compactText(captionBrief?.goal || ''),
      audienceFeeling: compactText(captionBrief?.audienceFeeling || ''),
      writingDirectives: (captionBrief?.writingDirectives || []).map(compactText).filter(Boolean).slice(0, 10),
      avoidList: (captionBrief?.avoidList || []).map(compactText).filter(Boolean).slice(0, 8),
      personaSummaryZh: compactText(captionBrief?.contentBlocks?.personaSummaryZh || ''),
      sceneSemantics: captionBrief?.contentBlocks?.sceneSemantics || {},
      worldState: captionBrief?.contentBlocks?.worldState || {},
      hashtagAngles: (captionBrief?.contentBlocks?.hashtagAngles || []).map(compactText).filter(Boolean).slice(0, 6),
      delivery: captionBrief?.delivery || {}
    },
    continuityGuards: {
      avoidOpenings: recentOpenings,
      avoidHashtags: frequentHashtags
    }
  };
}

module.exports = {
  buildCaptionTaskInput,
  buildFallbackCandidates,
  inferFallbackProfile
};
