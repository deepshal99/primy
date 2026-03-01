---
name: claude-cookbooks
description: Best practices from Anthropic's official Claude Cookbooks for building with the Claude API, Agent SDK, Skills, and tool use. Use when building AI features, writing prompts, creating agents, or integrating Claude into applications.
---

# Claude Cookbooks — Best Practices Reference

A distilled reference of patterns, conventions, and best practices from Anthropic's official Claude Cookbooks repository. Use this when building anything with the Claude API, Agent SDK, Skills system, or tool integrations.

## Claude API Best Practices

### Model References
- **Always use non-dated model aliases**: `claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-opus-4-6`
- **Never use dated model IDs** like `claude-sonnet-4-6-20250514`
- **Bedrock model IDs** follow a different format:
  - Opus 4.6: `anthropic.claude-opus-4-6-v1`
  - Sonnet 4.5: `anthropic.claude-sonnet-4-5-20250929-v1:0`
  - Haiku 4.5: `anthropic.claude-haiku-4-5-20251001-v1:0`
  - Prepend `global.` for global endpoints: `global.anthropic.claude-opus-4-6-v1`
- **Define MODEL as a constant** at the top of files for easy updates

### API Key Handling
- Never hardcode API keys — use environment variables
- Prefer `dotenv.load_dotenv()` over `os.environ` for local dev
- The Anthropic SDK auto-reads `ANTHROPIC_API_KEY` from env — no need to pass explicitly:
  ```python
  from anthropic import Anthropic
  client = Anthropic()  # reads ANTHROPIC_API_KEY automatically
  ```

### Error Handling
- Be specific with exception types — never use bare `except:`
- Don't over-handle errors in examples/demos — cookbooks are not production code
- Only validate at system boundaries (user input, external APIs)

## Claude Agent SDK Patterns

### Core Concepts
- `query()` is the basic agent loop function
- `ClaudeSDKClient` and `ClaudeAgentOptions` are the primary interfaces
- System prompts specialize agent behavior
- Agents can use WebSearch, Read, Bash, and MCP tools

### Agent Architecture Patterns

**Simple Research Agent**: Single agent + WebSearch for autonomous research
```python
from claude_code_sdk import query, ClaudeSDKClient, ClaudeAgentOptions
# One-liner pattern: query() with system prompt + tools
```

**Chief of Staff Pattern**: Multi-agent orchestration with:
- CLAUDE.md for persistent instructions
- Output styles for different audiences (executive vs technical)
- Plan mode for strategic planning without execution
- Custom slash commands for common operations
- Hooks for compliance tracking and audit trails
- Subagent orchestration for domain expertise
- Bash tool for Python script execution

**Observability Agent Pattern**: External system integration via MCP
- Git MCP Server for repository analysis
- GitHub MCP Server for platform integration
- Real-time monitoring and incident response

### Agent Design Principles
- Break complex tasks into manageable autonomous steps
- Use tools intelligently — choose the right tool for each step
- Maintain context across long-running tasks
- Recover gracefully from errors and adapt approaches
- Know when to ask for clarification vs proceed with assumptions

## Claude Skills System

### Built-in Skills
| Skill | ID | Description |
|-------|-----|-------------|
| Excel | `xlsx` | Workbooks with formulas, charts, formatting |
| PowerPoint | `pptx` | Professional presentations |
| PDF | `pdf` | Formatted documents |
| Word | `docx` | Rich Word documents |

### Skills API Requirements
- All Skills use `client.beta.*` namespace
- Required beta headers: `code-execution-2025-08-25`, `files-api-2025-04-14`, `skills-2025-10-02`
- Must use `client.beta.messages.create()` with `container` parameter
- Code execution tool (`code_execution_20250825`) is REQUIRED
- Use `betas` parameter per-request, not in `default_headers`

### Files API Integration
- Skills return `file_id` in responses — download via `client.beta.files.download(file_id)`
- Use `.read()` for binary content (not `.content`)
- Use `.size_bytes` for file size (not `.size`)
- `client.beta.files.retrieve_metadata()` for file info

### Custom Skill Structure
```
my_skill/
├── SKILL.md           # Required: Instructions for Claude
├── scripts/           # Optional: Executable code
│   └── processor.py
└── resources/         # Optional: Templates, data
    └── template.xlsx
```

### SKILL.md Format
```markdown
---
name: skill-name
description: What this skill does and when to use it
---

# Skill Title

## Capabilities
[What the skill can do]

## How to Use
[Step-by-step usage]

## Input/Output Format
[Expected data formats]

## Scripts
[Reference to included code files]

## Best Practices
[Domain-specific guidelines]

## Limitations
[Known constraints]
```

## Tool Use Patterns

### Tool Definition Best Practices
- Define tools with clear, specific descriptions
- Include parameter constraints and examples
- Handle tool results gracefully — check for errors
- Use tool chaining for complex multi-step operations

### Memory Tool Pattern
- Persistent memory across conversations
- Code review context tracking
- Session state management

## Code Quality Standards

### Python Style (from Cookbooks)
- **Line length**: 100 characters
- **Quotes**: Double quotes
- **Formatter**: Ruff (`ruff format` + `ruff check`)
- Modern Python: `str | None` over `Optional[str]`
- Early returns over nested conditionals
- Descriptive variable names
- Comments explain "why", not "what"

### Git Conventions
- **Branch naming**: `<username>/<feature-description>`
- **Conventional commits**: `feat(scope):`, `fix(scope):`, `docs(scope):`
- Atomic commits — one logical change per commit

## Content & Documentation Principles

### Problem-First Framing
- Lead with the problem being solved, not the machinery being built
- State learning objectives upfront as bullet points (2-4 TLOs)
- Map back to objectives in conclusions

### Writing Style
- Educational and agency-building tone
- Professional but approachable
- Respect user intelligence and time
- Active voice, short paragraphs (3-5 sentences)
- Always explain before showing code, explain what was learned after

### Anti-Patterns to Avoid
- Leading with machinery: "We will build X using Y SDK..."
- Feature dumps without context
- Vague objectives: "Learn about agents"
- Generic summaries that don't guide next actions
- Code blocks without preceding explanation
- Over-explaining obvious code

## Evaluation & Testing

### Building Evals
- Use Claude to automate prompt evaluation
- Define clear scoring rubrics with specific dimensions
- Test that code examples run top-to-bottom without errors
- Keep examples focused — one concept per unit

### Quality Checklist
- [ ] Uses current, non-dated model aliases
- [ ] No hardcoded API keys
- [ ] Clean setup with grouped installs
- [ ] Explanatory text before/after code blocks
- [ ] Maps back to stated learning objectives
- [ ] Runs without modification (except API keys)
