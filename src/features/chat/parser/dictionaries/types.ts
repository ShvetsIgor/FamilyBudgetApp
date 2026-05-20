export interface ItemEntry {
  categoryId: string;
}

export interface ItemMatch {
  categoryId: string;
  keyword: string;
}

/** Used by learned-keywords and parse context */
export interface KeywordHit {
  categoryId: string;
}
