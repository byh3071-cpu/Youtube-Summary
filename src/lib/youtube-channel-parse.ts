/**
 * 사용자 입력(URL 또는 채널 ID)에서 채널 ID·핸들·영상 ID 추출.
 * - youtube.com/channel/UCxxx → channelId
 * - youtube.com/@handle, @handle → handle
 * - UCxxxxxxxxxxxxxxxxxx (24자) → channelId
 * - watch?v=·youtu.be·shorts·live·embed 영상 URL → videoId (채널로 역해석용)
 */

const CHANNEL_ID_REGEX = /^UC[\w-]{22}$/;
const CHANNEL_URL_ID_REGEX = /(?:youtube\.com\/channel\/)(UC[\w-]{22})/i;
// /@handle 또는 /@%EC%95%88%EB%85%95 같은 퍼센트 인코딩 핸들까지 허용
const HANDLE_URL_REGEX = /(?:youtube\.com\/)@([^/?\s]+)/i;
// @handle, handle, @한글, @%EC%95%88%EB%85%95 등 대부분의 문자열 허용 (공백/슬래시 제외)
const HANDLE_ONLY_REGEX = /^@?([^\s/]{2,})$/;

// 영상 URL 패턴. 영상 ID는 항상 11자 — 11자 검증이 없으면 /@handle/live,
// /@handle/videos 같은 채널 탭 URL이 영상으로 오분류된다.
// (youtube.com/live/<id>는 도메인 바로 뒤 경로라 /@handle/live와 겹치지 않음)
const VIDEO_URL_REGEXES = [
  /youtube\.com\/watch\?(?:[^#\s]*&)?v=([\w-]{11})(?=[^\w-]|$)/i, // m.·music. 서브도메인 포함
  /youtu\.be\/([\w-]{11})(?=[^\w-]|$)/i,
  /youtube\.com\/shorts\/([\w-]{11})(?=[^\w-]|$)/i,
  /youtube\.com\/live\/([\w-]{11})(?=[^\w-]|$)/i,
  /youtube\.com\/embed\/([\w-]{11})(?=[^\w-]|$)/i,
];

export type ParsedChannelInput =
  | { type: "channelId"; channelId: string }
  | { type: "handle"; handle: string }
  | { type: "videoId"; videoId: string }
  | null;

export function parseYouTubeChannelInput(input: string): ParsedChannelInput {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 이미 채널 ID 형식 (UC + 22자)
  if (CHANNEL_ID_REGEX.test(trimmed)) {
    return { type: "channelId", channelId: trimmed };
  }

  // URL: /channel/UCxxx
  const channelUrlMatch = trimmed.match(CHANNEL_URL_ID_REGEX);
  if (channelUrlMatch) {
    return { type: "channelId", channelId: channelUrlMatch[1] };
  }

  // URL: /@handle
  const handleUrlMatch = trimmed.match(HANDLE_URL_REGEX);
  if (handleUrlMatch) {
    const raw = handleUrlMatch[1];
    const handle = raw.includes("%") ? decodeURIComponent(raw) : raw;
    return { type: "handle", handle };
  }

  // 영상 URL — 채널이 아니라 영상을 붙여넣어도 그 채널을 찾을 수 있게.
  // HANDLE_ONLY보다 앞이어야 슬래시 없는 조각이 핸들로 오인되기 전에 잡힌다.
  for (const regex of VIDEO_URL_REGEXES) {
    const match = trimmed.match(regex);
    if (match) {
      return { type: "videoId", videoId: match[1] };
    }
  }

  // @handle 또는 handle 만
  const handleOnlyMatch = trimmed.match(HANDLE_ONLY_REGEX);
  if (handleOnlyMatch && handleOnlyMatch[1].length >= 2) {
    const raw = handleOnlyMatch[1];
    const handle = raw.includes("%") ? decodeURIComponent(raw) : raw;
    return { type: "handle", handle };
  }

  return null;
}
