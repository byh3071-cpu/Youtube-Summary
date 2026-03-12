"use client";

import type { ReactNode } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";

interface AutoAnimateListProps {
  children: ReactNode;
  as?: "ul" | "div";
  className?: string;
}

/** 리스트 자식 추가/삭제/순서 변경 시 자동 전환 애니메이션 */
export function AutoAnimateList({ children, as: Tag = "div", className }: AutoAnimateListProps) {
  const [ref] = useAutoAnimate<HTMLElement>();
  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
