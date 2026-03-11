/**
 * 사용자 입력(URL 또는 채널 ID)에서 채널 ID 또는 핸들 추출.
 * - youtube.com/channel/UCxxx → channelId
 * - youtube.com/@handle, @handle → handle
 * - UCxxxxxxxxxxxxxxxxxx (24자) → channelId
 */

const CHANNEL_ID_REGEX = /^UC[\w-]{22}$/;
const CHANNEL_URL_ID_REGEX = /(?:youtube\.com\/channel\/)(UC[\w-]{22})/i;
// /@handle 또는 /@%EC%95%88%EB%85%95 같은 퍼센트 인코딩 핸들까지 허용
const HANDLE_URL_REGEX = /(?:youtube\.com\/)@([^/?\s]+)/i;
// @handle, handle, @한글, @%EC%95%88%EB%85%95 등 대부분의 문자열 허용 (공백/슬래시 제외)
const HANDLE_ONLY_REGEX = /^@?([^\s/]{2,})$/;

export type ParsedChannelInput =
  | { type: "channelId"; channelId: string }
  | { type: "handle"; handle: string }
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

  // @handle 또는 handle 만
  const handleOnlyMatch = trimmed.match(HANDLE_ONLY_REGEX);
  if (handleOnlyMatch && handleOnlyMatch[1].length >= 2) {
    const raw = handleOnlyMatch[1];
    const handle = raw.includes("%") ? decodeURIComponent(raw) : raw;
    return { type: "handle", handle };
  }

  return null;
}
