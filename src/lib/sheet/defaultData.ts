import { SheetData } from "@/lib/types";

export const createEmptySheet = (): SheetData[] => [
  {
    name: "Sheet1",
    order: 0,
    status: 1,
    celldata: [],
    config: {},
    row: 50,
    column: 26,
  },
];
