const OPEN_ANSWER_FORM_PATTERN =
  /(?:주관식|주관형|서술형|서술식|논술형|자유\s*(?:답변|서술|입력|문항)|직접\s*(?:입력|작성)|open[-\s]?(?:ended|question)|open\s+question|free[-\s]?form|subjective|descriptive)/iu;
const BINARY_CHOICE_FORM_PATTERN =
  /(?:찬성\s*[/·또는과]*\s*반대|반대\s*[/·또는과]*\s*찬성|찬반|동의\s*[/·또는과]*\s*비동의|예\s*[/ ]?아니오|yes\s*[/ ]?no|agree\s*[/ ]?disagree|support\s*[/ ]?oppose)/iu;
const GENERIC_OBJECTIVE_CHOICE_FORM_PATTERN = /(?:객관식|선택형|multiple[-\s]?choice)/iu;
const SINGLE_CHOICE_FORM_PATTERN =
  /(?:하나(?:를|만)?\s*(?:선택|고르)|중\s*(?:하나|한\s*가지)|여러\s*(?:종류|유형|가지)\s*중\s*하나|단일\s*선택|선다형|single[-\s]?choice|one[-\s]?of[-\s]?many|choose\s+one|pick\s+one)/iu;
const DISTINCT_SINGLE_CHOICE_FORM_PATTERN =
  /(?:여러\s*(?:종류|유형|가지)\s*중\s*하나|(?:후보|옵션|선택지|고객|세그먼트|종류|유형)[^.!?。！？\n]{0,60}(?:하나|선택|고르)|단일\s*선택|선다형|single[-\s]?choice|one[-\s]?of[-\s]?many|choose\s+one|pick\s+one)/iu;
const MULTI_SELECT_FORM_PATTERN =
  /(?:하나\s*(?:혹은|또는)?\s*여러\s*개|하나\s*이상|복수(?:\s*답변|\s*선택)?|다중|여러\s*(?:개|항목|가지)|multi[-\s]?select|one\s+or\s+more|choose\s+one\s+or\s+more|select\s+all|choose\s+multiple)/iu;
const RANKED_CHOICE_FORM_PATTERN = /(?:우선순위|우선\s*순위|순위|랭킹|rank(?:ed|ing)?|priorit(?:y|ize|ise))/iu;

const ANSWER_FORM_POLICY_PATTERN =
  /(?:답변|answer)[^.!?。！？\n]{0,80}(?:다양|필요에\s*맞게|경우에\s*맞게|구성|형식|방식|종류|타입|form|format|type)|(?:모든|전부|항상)[^.!?。！？\n]{0,60}(?:찬성|반대|찬반|pro\s*[/ ]?con)[^.!?。！？\n]{0,40}(?:아니라|되는\s*게\s*아니라|될\s*필요가\s*없)|(?:질문마다|각\s*질문|상황마다|필요에\s*따라)[^.!?。！？\n]{0,80}(?:답변|answer)[^.!?。！？\n]{0,60}(?:달라|다르게|다양|형식|방식)/iu;

export function countMentionedAnswerFormFamilies(value: string) {
  const hasBinaryChoice = BINARY_CHOICE_FORM_PATTERN.test(value);
  const hasMultiSelect = MULTI_SELECT_FORM_PATTERN.test(value);
  const hasRankedChoice = RANKED_CHOICE_FORM_PATTERN.test(value);
  const hasSingleChoice =
    (SINGLE_CHOICE_FORM_PATTERN.test(value) && (!hasBinaryChoice || DISTINCT_SINGLE_CHOICE_FORM_PATTERN.test(value))) ||
    (GENERIC_OBJECTIVE_CHOICE_FORM_PATTERN.test(value) && !hasBinaryChoice && !hasMultiSelect && !hasRankedChoice);

  return [
    OPEN_ANSWER_FORM_PATTERN.test(value),
    hasBinaryChoice,
    hasSingleChoice,
    hasMultiSelect,
    hasRankedChoice
  ].filter(Boolean).length;
}

export function describesAnswerFormPolicy(value: string) {
  return countMentionedAnswerFormFamilies(value) >= 2 && ANSWER_FORM_POLICY_PATTERN.test(value);
}
