declare module 'turndown' {
  interface TurndownOptions {
    headingStyle?: 'setext' | 'atx';
    hr?: string;
    bulletListMarker?: '-' | '+' | '*';
    codeBlockStyle?: 'indented' | 'fenced';
    fence?: '```' | '~~~';
    emDelimiter?: '_' | '*';
    strongDelimiter?: '__' | '**';
    linkStyle?: 'inlined' | 'referenced';
    linkReferenceStyle?: 'full' | 'collapsed' | 'shortcut';
  }

  class TurndownService {
    constructor(options?: TurndownOptions);
    turndown(html: string | HTMLElement): string;
    keep(filter: string | string[] | ((node: HTMLElement) => boolean)): this;
    remove(filter: string | string[] | ((node: HTMLElement) => boolean)): this;
    addRule(key: string, rule: object): this;
    use(plugin: ((service: TurndownService) => void) | ((service: TurndownService) => void)[]): this;
  }

  export = TurndownService;
}
