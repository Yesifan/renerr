# Context Glossary

## Library path

A user-configured media library root path under a WebDAV source, such as `/tv` or `/movies`. It is distinct from the WebDAV source URL and from individual rename plan source file paths.

A Library path is created once and is not edited later. Changing a media root is modeled as creating a different Library path, not mutating the existing one.

## Library path suggestions

Read-only WebDAV directory candidates shown while editing a Library path. Suggestions help users choose a remote directory but do not replace the final submitted path string.

## WebDAV source URL

The configured WebDAV endpoint and credential boundary for a source. Renarr does not split or rewrite this URL into a higher-level server root.

## Rename plan source file path

The full remote path of an existing file represented by a rename plan row. It is not edited through Library path suggestions.
