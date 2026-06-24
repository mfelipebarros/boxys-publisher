"""Fonte: MCP do Figma (caminho interativo / desktop).

Quando usar: alguém com o Figma desktop aberto, iterando template por template
num ambiente agêntico (Claude Code, Cursor, Claude com conector). O Dev Mode MCP
server do Figma roda LOCALMENTE (tipicamente em http://127.0.0.1:3845) e expõe
o contexto da seleção atual.

Esta classe é um ADAPTADOR: o app externo age como CLIENTE MCP, pega o nó
selecionado e o devolve no MESMO formato do Figma. A partir daí, o fluxo é
idêntico ao da API (normalize -> generate -> upload).

NOTA HONESTA: a superfície de ferramentas do Dev Mode MCP ainda evolui e os
nomes/formato de retorno podem mudar. Por isso o método abaixo está marcado
para ser fechado quando definirmos QUAL cliente MCP o app vai embarcar
(SDK `mcp` em Python, ou um cliente HTTP/SSE simples contra o servidor local).
O contrato com o resto do sistema, porém, já está fixo: precisa devolver um
dict no formato de nó do Figma (com absoluteBoundingBox, children, etc.).
"""

from __future__ import annotations

from typing import Any, Protocol


class McpClient(Protocol):
    """Interface mínima que qualquer cliente MCP concreto deve cumprir."""

    def call_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]: ...


class FigmaMcpSource:
    def __init__(self, client: McpClient) -> None:
        self._client = client

    def get_selected_node(self) -> dict[str, Any]:
        """Pega o nó atualmente selecionado no Figma desktop.

        Deve retornar um dict no formato de nó do Figma, pronto para
        `normalize.normalize(...)`. O nome da ferramenta abaixo é um
        placeholder a confirmar contra o servidor MCP real.
        """
        result = self._client.call_tool("get_selection", {})
        node = self._extract_node(result)
        if node is None:
            raise RuntimeError(
                "MCP não retornou um nó utilizável. Verifique se há um FRAME "
                "selecionado no Figma e se o Dev Mode MCP server está ativo."
            )
        return node

    @staticmethod
    def _extract_node(result: dict[str, Any]) -> dict[str, Any] | None:
        # Tolerante a formatos: alguns servidores devolvem {document: {...}},
        # outros o nó direto. Calibrar quando fecharmos o cliente MCP.
        if not isinstance(result, dict):
            return None
        if result.get("absoluteBoundingBox"):
            return result
        for key in ("document", "node", "selection"):
            inner = result.get(key)
            if isinstance(inner, dict) and inner.get("absoluteBoundingBox"):
                return inner
        return None
