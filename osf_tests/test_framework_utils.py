import pytest

from modularodm import Q

from tests.base import DbTestCase
from osf_tests import factories

from framework.database import get_or_http_error, autoload
from framework.exceptions import HTTPError

from osf.models import Node


class FrameworkUtilsTestCase(DbTestCase):
    def test_get_or_http_error_by_pk_found(self):
        n = factories.NodeFactory()
        found = get_or_http_error(Node, n._id)
        assert found == n

    def test_get_or_http_error_by_pk_not_found(self):
        with pytest.raises(HTTPError):
            get_or_http_error(Node, 'blah')

    def test_get_or_http_error_by_query_found(self):
        n = factories.NodeFactory()
        found = get_or_http_error(
            Node,
            (Q('title', 'eq', n.title) & Q('_id', 'eq', n._id))
        )
        assert found == n

    def test_get_or_http_error_by_query_not_found(self):
        with pytest.raises(HTTPError):
            get_or_http_error(Node, Q('_id', 'eq', 'blah'))

    def test_get_or_http_error_by_query_not_unique(self):
        title = 'TITLE'
        factories.NodeFactory(title=title)
        factories.NodeFactory(title=title)
        with pytest.raises(HTTPError):
            get_or_http_error(Node, Q('title', 'eq', title))

    def test_autoload(self):

        target = factories.NodeFactory()

        def fn(node, *args, **kwargs):
            return node

        wrapped = autoload(Node, 'node_id', 'node', fn)
        found = wrapped(node_id=target._id)
        assert found == target
