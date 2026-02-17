declare module 'react-pivottable/PivotTableUI' {
  import { Component } from 'react';

  interface PivotTableUIProps {
    data: Record<string, any>[];
    onChange: (state: any) => void;
    renderers?: Record<string, any>;
    [key: string]: any;
  }

  export default class PivotTableUI extends Component<PivotTableUIProps> {}
}

declare module 'react-pivottable/TableRenderers' {
  const TableRenderers: Record<string, any>;
  export default TableRenderers;
}

declare module 'react-pivottable/PivotTable' {
  import { Component } from 'react';

  interface PivotTableProps {
    data: Record<string, any>[];
    [key: string]: any;
  }

  export default class PivotTable extends Component<PivotTableProps> {}
}

declare module 'react-pivottable/Utilities' {
  export const aggregators: Record<string, any>;
  export const derivers: Record<string, any>;
  export const locales: Record<string, any>;
  export const naturalSort: any;
  export const numberFormat: any;
  export const getSort: any;
  export const sortAs: any;
}
