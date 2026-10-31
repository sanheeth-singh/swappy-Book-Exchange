"""Compare contract HTTP operations with the sibling backend's route decorators."""
import ast
import json
import sys
from pathlib import Path

backend = Path(sys.argv[1] if len(sys.argv) > 1 else '../backend')
if not (backend / 'app/api/v1/router.py').exists():
    raise SystemExit('Provide the current backend directory: python scripts/verify-backend-contract.py ../backend')
actual = {('GET', '/health')}
for file in (backend / 'app/api/v1').glob('*.py'):
    tree = ast.parse(file.read_text(encoding='utf-8-sig'))
    prefix = ''
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == 'APIRouter':
            prefix = next((ast.literal_eval(k.value) for k in node.keywords if k.arg == 'prefix'), '')
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for dec in node.decorator_list:
                if isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute) and dec.func.attr in ['get', 'post', 'put', 'patch', 'delete']:
                    actual.add((dec.func.attr.upper(), '/api/v1' + prefix + ast.literal_eval(dec.args[0])))
spec = json.loads(Path('contracts/openapi.json').read_text())
expected = {(m.upper(), p) for p, methods in spec['paths'].items() for m in methods if m in ['get', 'post', 'put', 'patch', 'delete']}
if actual != expected:
    raise SystemExit(f'Route differences: {sorted(actual ^ expected)}')
print(f'{len(actual)} source HTTP operations match the contract. This checks paths/methods, not schema or permission equivalence.')
