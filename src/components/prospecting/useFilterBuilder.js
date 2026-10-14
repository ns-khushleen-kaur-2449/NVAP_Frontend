import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getFilterFields, parseFilterText } from '@/lib/api';
import {
  MAX_CONDITIONS,
  buildFilterPayload,
  describeApiError,
  findIncompleteCondition,
  isAiUnavailable,
  issuesByCondition,
  newCondition,
} from '@/components/prospecting/filterUtils';

// Each condition on screen carries its own id so rows keep their state when one is removed.
let lastConditionId = 0;
const withId = (condition) => { lastConditionId += 1; return { ...condition, id: lastConditionId }; };

/**
 * The state behind one filter being built: the field list, the sentence and its
 * parse result, and the editable conditions. Each screen that calls this gets
 * its own independent filter. Rendered by <FilterBuilder />.
 */
export default function useFilterBuilder() {
  const [fields, setFields] = useState(null);
  const [fieldsLoading, setFieldsLoading] = useState(true);
  const [fieldsError, setFieldsError] = useState(null);

  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [parseError, setParseError] = useState(null);

  // The filter being edited. This is the source of truth, not what an API echoes back.
  const [match, setMatch] = useState('all');
  const [conditions, setConditions] = useState([]);
  // Messages the backend gave for single conditions, keyed by the condition's on-screen id.
  const [conditionErrors, setConditionErrors] = useState({});

  // Guards against setting state after the screen unmounts mid-request.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const loadFields = useCallback(async () => {
    setFieldsLoading(true);
    setFieldsError(null);
    try {
      const { data } = await getFilterFields();
      if (mounted.current) setFields(data?.fields || []);
    } catch (error) {
      if (mounted.current) setFieldsError(describeApiError(error, 'Could not load the filter fields.'));
    } finally {
      if (mounted.current) setFieldsLoading(false);
    }
  }, []);

  useEffect(() => { loadFields(); }, [loadFields]);

  const fieldsByKey = useMemo(
    () => Object.fromEntries((fields || []).map((field) => [field.key, field])),
    [fields],
  );

  const trimmed = text.trim();
  const canParse = trimmed.length > 0 && !parsing && !fieldsLoading && !fieldsError;

  const runParse = async () => {
    if (!canParse) return;
    setParsing(true);
    setParseError(null);
    try {
      const { data } = await parseFilterText(trimmed);
      if (!mounted.current) return;
      const parsedConditions = data?.filter?.conditions || [];
      // A sentence that gave no conditions leaves the filter being edited as it is.
      if (parsedConditions.length > 0) {
        setMatch(data.filter.match === 'any' ? 'any' : 'all');
        setConditions(parsedConditions.map(withId));
        setConditionErrors({});
      }
      setParsed({
        empty: parsedConditions.length === 0,
        dropped: data?.dropped || [],
        notUnderstood: data?.not_understood || [],
      });
    } catch (error) {
      if (!mounted.current) return;
      const aiDown = isAiUnavailable(error);
      const message = describeApiError(error, 'Could not turn that sentence into a filter.');
      // The sentence and any earlier result stay as they are, so nothing the user did is lost.
      setParseError({ message, aiDown });
      if (!aiDown) toast.error(message);
    } finally {
      if (mounted.current) setParsing(false);
    }
  };

  const atLimit = conditions.length >= MAX_CONDITIONS;
  // Until the field list has loaded, only the basic checks can run.
  const incomplete = findIncompleteCondition(conditions, fields ? fieldsByKey : null);

  const addCondition = () => {
    if (atLimit || !fields?.length) return;
    setConditions((current) => [...current, withId(newCondition(fields[0]))]);
  };
  const clearConditionError = (id) => setConditionErrors((current) => {
    if (!(id in current)) return current;
    const { [id]: _cleared, ...rest } = current;
    return rest;
  });
  const changeCondition = (id, next) => {
    setConditions((current) => current.map((item) => (item.id === id ? next : item)));
    clearConditionError(id);
  };
  const removeCondition = (id) => {
    setConditions((current) => current.filter((item) => item.id !== id));
    clearConditionError(id);
  };

  /** What to send to a search: the filter, and the on-screen id of each of its conditions. */
  const buildRequest = () => ({ payload: buildFilterPayload(match, conditions), ids: conditions.map((item) => item.id) });

  /**
   * Replace the filter on screen with `filter` ({ match, conditions }), for example a saved one.
   * Returns the request for it, as buildRequest() would once the new conditions are on screen.
   */
  const loadFilter = (filter) => {
    const nextMatch = filter?.match === 'any' ? 'any' : 'all';
    const nextConditions = (filter?.conditions || []).map(({ field, op, value }) => withId({ field, op, value }));
    setMatch(nextMatch);
    setConditions(nextConditions);
    setConditionErrors({});
    return { payload: buildFilterPayload(nextMatch, nextConditions), ids: nextConditions.map((item) => item.id) };
  };

  /** Show a 400 "Invalid filter" response on the rows it names. `request` is what buildRequest() returned. */
  const showConditionIssues = (error, request) => {
    const byPosition = issuesByCondition(error);
    setConditionErrors(Object.fromEntries(
      Object.entries(byPosition).filter(([position]) => request.ids[position] !== undefined)
        .map(([position, message]) => [request.ids[position], message]),
    ));
  };

  /** True when the filter on screen is no longer the one in `request`. */
  const differsFrom = (request) => Boolean(request)
    && JSON.stringify(request.payload) !== JSON.stringify(buildFilterPayload(match, conditions));

  return {
    fields, fieldsLoading, fieldsError, loadFields, fieldsByKey,
    text, setText, parsing, parsed, parseError, canParse, runParse,
    match, setMatch, conditions, addCondition, changeCondition, removeCondition,
    atLimit, incomplete,
    conditionErrors, clearConditionErrors: () => setConditionErrors({}), showConditionIssues,
    buildRequest, loadFilter, differsFrom,
  };
}
