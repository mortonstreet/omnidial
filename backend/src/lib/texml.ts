/**
 * TeXML response builders.
 *
 * Telnyx TeXML is markup-compatible with Twilio TwiML, so these builders
 * expose the same fluent API the `twilio` SDK's `twiml.VoiceResponse` /
 * `twiml.MessagingResponse` provided. Attribute keys are emitted verbatim
 * (TeXML uses the same camelCase attribute names as TwiML).
 */

type AttributeValue = string | number | boolean | string[] | undefined

export type Attributes = Record<string, AttributeValue>

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const serializeAttributes = (attributes?: Attributes): string => {
  if (!attributes) return ''

  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      const serialized = Array.isArray(value)
        ? value.join(' ')
        : typeof value === 'boolean'
          ? value
            ? 'true'
            : 'false'
          : String(value)
      return ` ${key}="${escapeXml(serialized)}"`
    })
    .join('')
}

class TexmlNode {
  private readonly name: string
  private readonly attributes?: Attributes
  private readonly text?: string
  private readonly children: TexmlNode[] = []

  constructor(name: string, attributes?: Attributes, text?: string) {
    this.name = name
    this.attributes = attributes
    this.text = text
  }

  addChild(name: string, attributes?: Attributes, text?: string): TexmlNode {
    const child = new TexmlNode(name, attributes, text)
    this.children.push(child)
    return child
  }

  render(): string {
    const attrs = serializeAttributes(this.attributes)
    if (this.children.length === 0 && this.text === undefined) {
      return `<${this.name}${attrs}/>`
    }
    const inner =
      (this.text !== undefined ? escapeXml(this.text) : '') +
      this.children.map((child) => child.render()).join('')
    return `<${this.name}${attrs}>${inner}</${this.name}>`
  }
}

/**
 * The `<Dial>` verb wrapper. Supports the nouns used by this app:
 * `<Conference>`, `<Client>`, `<Number>`, `<Sip>`.
 */
export class DialBuilder {
  private readonly node: TexmlNode

  constructor(node: TexmlNode) {
    this.node = node
  }

  conference(attributesOrName: Attributes | string, name?: string): this {
    if (typeof attributesOrName === 'string') {
      this.node.addChild('Conference', undefined, attributesOrName)
    } else {
      this.node.addChild('Conference', attributesOrName, name)
    }
    return this
  }

  client(attributesOrIdentity: Attributes | string, identity?: string): this {
    if (typeof attributesOrIdentity === 'string') {
      this.node.addChild('Client', undefined, attributesOrIdentity)
    } else {
      this.node.addChild('Client', attributesOrIdentity, identity)
    }
    return this
  }

  number(attributesOrNumber: Attributes | string, number?: string): this {
    if (typeof attributesOrNumber === 'string') {
      this.node.addChild('Number', undefined, attributesOrNumber)
    } else {
      this.node.addChild('Number', attributesOrNumber, number)
    }
    return this
  }

  sip(attributesOrUri: Attributes | string, uri?: string): this {
    if (typeof attributesOrUri === 'string') {
      this.node.addChild('Sip', undefined, attributesOrUri)
    } else {
      this.node.addChild('Sip', attributesOrUri, uri)
    }
    return this
  }
}

/**
 * Drop-in replacement for `twilio.twiml.VoiceResponse`, emitting TeXML.
 */
export class VoiceResponse {
  private readonly root = new TexmlNode('Response')

  say(attributesOrText: Attributes | string, text?: string): this {
    if (typeof attributesOrText === 'string') {
      this.root.addChild('Say', undefined, attributesOrText)
    } else {
      this.root.addChild('Say', attributesOrText, text)
    }
    return this
  }

  play(attributesOrUrl: Attributes | string, url?: string): this {
    if (typeof attributesOrUrl === 'string') {
      this.root.addChild('Play', undefined, attributesOrUrl)
    } else {
      this.root.addChild('Play', attributesOrUrl, url)
    }
    return this
  }

  dial(attributes?: Attributes): DialBuilder {
    return new DialBuilder(this.root.addChild('Dial', attributes))
  }

  record(attributes?: Attributes): this {
    this.root.addChild('Record', attributes)
    return this
  }

  gather(attributes?: Attributes): this {
    this.root.addChild('Gather', attributes)
    return this
  }

  pause(attributes?: Attributes): this {
    this.root.addChild('Pause', attributes)
    return this
  }

  redirect(attributesOrUrl: Attributes | string, url?: string): this {
    if (typeof attributesOrUrl === 'string') {
      this.root.addChild('Redirect', undefined, attributesOrUrl)
    } else {
      this.root.addChild('Redirect', attributesOrUrl, url)
    }
    return this
  }

  hangup(): this {
    this.root.addChild('Hangup')
    return this
  }

  reject(attributes?: Attributes): this {
    this.root.addChild('Reject', attributes)
    return this
  }

  toString(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>${this.root.render()}`
  }
}

/**
 * Drop-in replacement for `twilio.twiml.MessagingResponse`, emitting TeXML.
 */
export class MessagingResponse {
  private readonly root = new TexmlNode('Response')

  message(attributesOrBody: Attributes | string, body?: string): this {
    if (typeof attributesOrBody === 'string') {
      this.root.addChild('Message', undefined, attributesOrBody)
    } else {
      this.root.addChild('Message', attributesOrBody, body)
    }
    return this
  }

  toString(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>${this.root.render()}`
  }
}
