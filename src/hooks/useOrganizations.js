import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

function useOrganizations() {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  async function fetchOrganizations() {
    const { data, error, status, statusText } = await supabase
      .from("organizations")
      .select("*");

    if (error) {
      console.log("Error fetching organizations:", error.message);
      return;
    }

    setOrganizations(data);
    setLoading(false);
  }

  return { organizations, loading, fetchOrganizations };
}

export default useOrganizations;
